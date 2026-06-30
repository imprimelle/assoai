import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { ProjectTask, KanbanColumn } from '@/types/project-task';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  GripHorizontal, ArrowRight, Eye, CheckSquare, ExternalLink,
  Minus, Plus as PlusIcon, Maximize2, X, Info,
  Clock, AlertTriangle, Lock, Zap, GitBranch,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// ── Types ──────────────────────────────────────────────────────────────────

interface Position { x: number; y: number }

interface TaskLinkedBoxProps {
  tasks: ProjectTask[];
  onTaskClick: (taskId: string) => void;
  projectName: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const CARD_W = 220;
const CARD_H = 115;
const CANVAS_SIZE = 3000;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.1;

const COLUMN_CONFIG: Record<KanbanColumn, { color: string; bg: string; border: string; label: string; icon: string }> = {
  a_faire:     { color: 'text-gray-600',  bg: 'bg-gray-50',  border: 'border-gray-200', label: 'À faire',   icon: '📋' },
  en_cours:    { color: 'text-orange-600',bg: 'bg-orange-50', border: 'border-orange-200', label: 'En cours',  icon: '🔄' },
  en_revision: { color: 'text-purple-600',bg: 'bg-purple-50',border: 'border-purple-200', label: 'Révision',  icon: '🔍' },
  termine:     { color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', label: 'Terminé',    icon: '✅' },
};

const PRIORITY_CONFIG: Record<string, string> = {
  low: 'text-gray-400', medium: 'text-yellow-500', high: 'text-orange-500', critical: 'text-red-500',
};

const ASSIGNEE_ICONS: Record<string, string> = {
  commerciale: '💼', chef_technique: '🔧', technicien_adjoint: '🔩',
  superviseur_logistique: '📋', directeur: '👔', directrice_adjointe: '👩‍💼',
};

// ── Storage ────────────────────────────────────────────────────────────────

const POS_STORAGE_KEY = 'task-linked-box-positions';

function loadPositions(): Record<string, Position> {
  try { return JSON.parse(localStorage.getItem(POS_STORAGE_KEY) || '{}'); } catch { return {}; }
}
function savePositions(pos: Record<string, Position>) {
  localStorage.setItem(POS_STORAGE_KEY, JSON.stringify(pos));
}

// ── Component ──────────────────────────────────────────────────────────────

export const TaskLinkedBox: React.FC<TaskLinkedBoxProps> = ({ tasks, onTaskClick, projectName }) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState<Record<string, Position>>(() => loadPositions());
  const draggingRef = useRef<string | null>(null);
  const dragOffsetRef = useRef<Position>({ x: 0, y: 0 });
  const [, setDragTick] = useState(0);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [hoveredLink, setHoveredLink] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const dragEndRef = useRef<(() => void) | null>(null);
  const dragMoved = useRef(false);

  const selectedTask = selectedCard ? tasks.find(t => t.id === selectedCard) : null;

  // ── Auto-layout (depth-based, left to right) ──────────────────────────

  useEffect(() => {
    setPositions(prev => {
      const updated = { ...prev };
      let changed = false;
      const activeTasks = tasks.filter(t => t.active);
      const PADDING = 50;

      const depth = new Map<string, number>();
      const getDepth = (t: ProjectTask, path: Set<string> = new Set()): number => {
        if (depth.has(t.id)) return depth.get(t.id)!;
        if (path.has(t.id)) return 0;
        path.add(t.id);
        const dep = activeTasks.find(x => x.id === t.depends_on);
        const d = dep ? getDepth(dep, path) + 1 : 0;
        depth.set(t.id, d);
        return d;
      };
      activeTasks.forEach(t => getDepth(t));

      const byDepth = new Map<number, ProjectTask[]>();
      activeTasks.forEach(t => {
        const d = depth.get(t.id) || 0;
        if (!byDepth.has(d)) byDepth.set(d, []);
        byDepth.get(d)!.push(t);
      });

      Array.from(byDepth.keys()).sort((a, b) => a - b).forEach(d => {
        const row = byDepth.get(d)!;
        const colW = CARD_W + 30;
        const rowH = CARD_H + 16;
        row.forEach((t, i) => {
          if (!(t.id in updated)) {
            updated[t.id] = { x: PADDING + d * colW, y: PADDING + i * rowH };
            changed = true;
          }
        });
      });

      if (changed) savePositions(updated);
      return updated;
    });
  }, [tasks]);

  // ── Fit zoom ──────────────────────────────────────────────────────────

  const fitZoom = useMemo(() => {
    if (tasks.length === 0) return 1;
    let maxX = 0, maxY = 0;
    tasks.forEach(t => {
      const pos = positions[t.id];
      if (!pos) return;
      maxX = Math.max(maxX, pos.x + CARD_W + 60);
      maxY = Math.max(maxY, pos.y + CARD_H + 60);
    });
    const vw = typeof window !== 'undefined' ? window.innerWidth - 48 : 800;
    const vh = typeof window !== 'undefined' ? window.innerHeight - 360 : 500;
    return Math.min(vw / maxX, vh / maxY, 1);
  }, [tasks, positions]);

  const hasAutoFit = useRef(false);
  useEffect(() => {
    if (!hasAutoFit.current && tasks.length > 0) {
      hasAutoFit.current = true;
      const t = setTimeout(() => setZoom(fitZoom), 100);
      return () => clearTimeout(t);
    }
  }, [fitZoom, tasks.length]);

  // ── Zoom ──────────────────────────────────────────────────────────────

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setZoom(z => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z + delta)));
  }, []);

  const zoomIn = () => setZoom(z => Math.min(MAX_ZOOM, z + ZOOM_STEP));
  const zoomOut = () => setZoom(z => Math.max(MIN_ZOOM, z - ZOOM_STEP));
  const zoomReset = () => setZoom(1);

  // ── Pinch zoom ────────────────────────────────────────────────────────

  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null);
  const getTouchDist = (touches: React.TouchList): number => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // ── Drag ──────────────────────────────────────────────────────────────

  const getEventPos = (e: React.MouseEvent | React.TouchEvent): { clientX: number; clientY: number } => {
    if ('touches' in e) return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
    return { clientX: e.clientX, clientY: e.clientY };
  };

  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent, taskId: string) => {
    if ('touches' in e && e.touches.length !== 1) return;
    e.preventDefault();
    const target = e.target as HTMLElement;
    if (target.closest('button, a')) return;
    const card = (e.target as HTMLElement).closest('[data-card]')?.getBoundingClientRect();
    if (!card) return;
    const pos = getEventPos(e);
    draggingRef.current = taskId;
    dragOffsetRef.current = { x: pos.clientX - card.left, y: pos.clientY - card.top };
    dragMoved.current = false;
    setDragTick(n => n + 1);
  }, []);

  const handleDragMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!draggingRef.current || !canvasRef.current) return;
    if ('touches' in e && e.touches.length !== 1) { dragEndRef.current?.(); return; }
    e.preventDefault();
    const canvas = canvasRef.current.getBoundingClientRect();
    const pos = getEventPos(e);
    const x = (pos.clientX - canvas.left) / zoom - dragOffsetRef.current.x;
    const y = (pos.clientY - canvas.top) / zoom - dragOffsetRef.current.y;
    const currentPos = positions[draggingRef.current];
    if (currentPos && (Math.abs(x - currentPos.x) > 3 || Math.abs(y - currentPos.y) > 3)) dragMoved.current = true;
    setPositions(prev => ({ ...prev, [draggingRef.current!]: { x: Math.max(0, x), y: Math.max(0, y) } }));
  }, [zoom, positions]);

  const handleDragEnd = useCallback(() => {
    if (draggingRef.current) { savePositions({ ...positions }); draggingRef.current = null; setDragTick(n => n + 1); }
  }, [positions]);
  dragEndRef.current = handleDragEnd;

  // ── Canvas touch ──────────────────────────────────────────────────────

  const handleCanvasTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) { e.preventDefault(); pinchRef.current = { dist: getTouchDist(e.touches), zoom }; dragMoved.current = false; }
    else pinchRef.current = null;
  };

  const handleCanvasTouchMove = (e: React.TouchEvent) => {
    if (pinchRef.current && e.touches.length === 2) {
      e.preventDefault();
      const newDist = getTouchDist(e.touches);
      const scale = newDist / pinchRef.current.dist;
      setZoom(Math.round(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinchRef.current.zoom * scale)) * 100) / 100);
      return;
    }
    if (draggingRef.current && e.touches.length === 1 && canvasRef.current) {
      e.preventDefault();
      const canvas = canvasRef.current.getBoundingClientRect();
      const pos = { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
      const x = (pos.clientX - canvas.left) / zoom - dragOffsetRef.current.x;
      const y = (pos.clientY - canvas.top) / zoom - dragOffsetRef.current.y;
      const cp = positions[draggingRef.current];
      if (cp && (Math.abs(x - cp.x) > 3 || Math.abs(y - cp.y) > 3)) dragMoved.current = true;
      setPositions(prev => ({ ...prev, [draggingRef.current!]: { x: Math.max(0, x), y: Math.max(0, y) } }));
    }
  };

  const handleCanvasTouchEnd = () => { pinchRef.current = null; if (draggingRef.current) { savePositions({ ...positions }); draggingRef.current = null; setDragTick(n => n + 1); } };

  const handleCanvasClick = () => setSelectedCard(null);

  // ── Dependencies ──────────────────────────────────────────────────────

  const dependsOn = selectedTask ? tasks.find(t => t.id === selectedTask.depends_on) : null;
  const dependents = selectedTask ? tasks.filter(t => t.depends_on === selectedTask.id) : [];

  // ── SVG arrows ────────────────────────────────────────────────────────

  const renderArrows = () => {
    const arrows: React.ReactNode[] = [];
    tasks.filter(t => t.active && t.depends_on).forEach(t => {
      const source = positions[t.depends_on!];
      const target = positions[t.id];
      if (!source || !target) return;
      const sx = source.x + CARD_W, sy = source.y + CARD_H / 2;
      const tx = target.x, ty = target.y + CARD_H / 2;
      const midX = (sx + tx) / 2;
      const isHovered = hoveredLink === t.id;
      const isSelected = selectedCard === t.id || selectedCard === t.depends_on;
      const arrowColor = isHovered ? '#f97316' : isSelected ? '#6366f1' : '#cbd5e1';
      const arrowWidth = isHovered || isSelected ? 2.5 : 1.5;
      arrows.push(
        <g key={`arrow-${t.id}`} onMouseEnter={() => setHoveredLink(t.id)} onMouseLeave={() => setHoveredLink(null)} style={{ cursor: 'pointer' }}>
          <path d={`M ${sx} ${sy} C ${midX} ${sy}, ${midX} ${ty}, ${tx} ${ty}`} fill="none" stroke="transparent" strokeWidth={14} />
          <path d={`M ${sx} ${sy} C ${midX} ${sy}, ${midX} ${ty}, ${tx} ${ty}`} fill="none" stroke={arrowColor} strokeWidth={arrowWidth}
            markerEnd={`url(#arrowhead-${isHovered ? 'hover' : 'normal'})`} className="transition-all duration-150" />
        </g>
      );
    });
    return arrows;
  };

  const renderGrid = () => {
    if (!showGrid) return null;
    const dots: React.ReactNode[] = [];
    for (let x = 40; x < CANVAS_SIZE; x += 40)
      for (let y = 40; y < CANVAS_SIZE; y += 40)
        dots.push(<circle key={`${x}-${y}`} cx={x} cy={y} r={1} fill="#d1d5db" />);
    return <g>{dots}</g>;
  };

  // ── Empty state ───────────────────────────────────────────────────────

  const activeTasks = tasks.filter(t => t.active);

  if (activeTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
          <GitBranch className="h-8 w-8 text-gray-400" />
        </div>
        <p className="text-sm font-medium text-gray-600 mb-1">Aucune tâche active</p>
        <p className="text-xs text-muted-foreground mb-4 max-w-xs">
          {tasks.length === 0
            ? 'Initialisez le projet pour créer des tâches Kanban.'
            : 'Toutes les tâches sont terminées ou inactives.'}
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 px-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center gap-0 bg-white border rounded-lg shadow-sm">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-r-none" onClick={zoomOut}>
              <Minus className="h-3 w-3" />
            </Button>
            <span className="text-[10px] font-medium tabular-nums w-10 text-center select-none">{Math.round(zoom * 100)}%</span>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-l-none" onClick={zoomIn}>
              <PlusIcon className="h-3 w-3" />
            </Button>
          </div>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setZoom(fitZoom)} title="Ajuster à l'écran">
            <Maximize2 className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">Ajuster</span>
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={zoomReset}>1:1</Button>
          <Button variant={showGrid ? 'secondary' : 'ghost'} size="sm" onClick={() => setShowGrid(!showGrid)} className="text-xs h-7">
            <Eye className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">Grille</span>
          </Button>
        </div>

        {/* Legend */}
        <div className="hidden sm:flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
          {Object.entries(COLUMN_CONFIG).map(([col, cfg]) => (
            <span key={col} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.border === 'border-gray-200' ? '#9ca3af' : cfg.border === 'border-orange-200' ? '#f97316' : cfg.border === 'border-purple-200' ? '#a855f7' : '#22c55e' }} />
              {cfg.icon} {cfg.label}
            </span>
          ))}
        </div>
      </div>

      {/* Canvas + Side panel */}
      <div className="flex gap-0">
        <div
          ref={canvasRef}
          className="relative rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 overflow-auto select-none flex-1"
          style={{ minHeight: 400, height: 'clamp(400px, calc(100vh - 340px), 800px)', touchAction: 'pan-x pan-y' }}
          onWheel={handleWheel}
          onMouseMove={(e) => handleDragMove(e)}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
          onTouchStart={handleCanvasTouchStart}
          onTouchMove={handleCanvasTouchMove}
          onTouchEnd={handleCanvasTouchEnd}
          onClick={handleCanvasClick}
        >
          <div className="relative" style={{ width: CANVAS_SIZE, height: CANVAS_SIZE, transform: `scale(${zoom})`, transformOrigin: '0 0' }}>
            <svg className="absolute inset-0 pointer-events-none" style={{ width: CANVAS_SIZE, height: CANVAS_SIZE, zIndex: 1 }}>
              <defs>
                <marker id="arrowhead-normal" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#cbd5e1" />
                </marker>
                <marker id="arrowhead-hover" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#f97316" />
                </marker>
              </defs>
              {renderGrid()}
              <g style={{ pointerEvents: 'auto' }}>{renderArrows()}</g>
            </svg>

            <div className="absolute inset-0" style={{ zIndex: 2 }}>
              {activeTasks.map(t => {
                const pos = positions[t.id] || { x: 0, y: 0 };
                const colCfg = COLUMN_CONFIG[t.kanban_column] || COLUMN_CONFIG.a_faire;
                const isDragging = draggingRef.current === t.id;
                const isHovered = hoveredCard === t.id;
                const isSelected = selectedCard === t.id;
                const dep = tasks.find(x => x.id === t.depends_on);

                return (
                  <div
                    key={t.id} data-card={t.id}
                    className={`absolute bg-white rounded-xl border shadow-sm overflow-hidden cursor-pointer
                      ${colCfg.border} ${isDragging ? 'shadow-2xl scale-105 z-50 opacity-90' : ''}
                      ${isHovered && !isDragging ? 'shadow-lg' : ''}
                      ${isSelected ? 'ring-2 ring-indigo-400 ring-offset-2 z-30' : ''}
                      transition-all duration-150`}
                    style={{ left: pos.x, top: pos.y, width: CARD_W, zIndex: isDragging ? 50 : isSelected ? 30 : 3 }}
                    onMouseEnter={() => setHoveredCard(t.id)}
                    onMouseLeave={() => setHoveredCard(null)}
                    onMouseDown={(e) => handleDragStart(e, t.id)}
                    onTouchStart={(e) => handleDragStart(e, t.id)}
                    onClick={(e) => { e.stopPropagation(); if (!dragMoved.current) setSelectedCard(isSelected ? null : t.id); dragMoved.current = false; }}
                  >
                    {/* Header */}
                    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 border-b ${colCfg.bg}`}>
                      <GripHorizontal className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className={`text-[9px] font-medium flex items-center gap-1 truncate ${colCfg.color}`}>
                        {colCfg.icon} {colCfg.label}
                      </span>
                      {!t.active && (
                        <Badge className="text-[8px] bg-gray-100 text-gray-500 border-gray-200 px-1 py-0 leading-none ml-auto">Inactif</Badge>
                      )}
                      {t.is_phase_validation && (
                        <Badge className="text-[8px] bg-red-100 text-red-700 border-red-200 px-1 py-0 leading-none ml-auto"><Lock className="h-2 w-2 mr-0.5 inline" />Val.</Badge>
                      )}
                    </div>

                    {/* Content */}
                    <div className="px-2.5 py-2">
                      {dep && (
                        <div className="flex items-center gap-1 mb-1.5 text-[9px] text-muted-foreground">
                          <ArrowRight className="h-2.5 w-2.5 text-blue-400 flex-shrink-0" />
                          <span className="truncate">← {dep.title.substring(0, 28)}</span>
                        </div>
                      )}
                      <p className={`text-xs font-semibold leading-tight mb-1.5 line-clamp-2 ${t.is_phase_validation ? 'text-red-700' : ''}`}>
                        {t.is_phase_validation ? '🔒 ' : ''}{t.title}
                      </p>
                      <div className="flex flex-wrap items-center gap-1 text-[9px] text-muted-foreground">
                        {t.assignee && <span>{ASSIGNEE_ICONS[t.assignee] || '👤'} {t.assignee}</span>}
                        {t.priority && <Zap className={`h-2.5 w-2.5 ${PRIORITY_CONFIG[t.priority] || ''}`} />}
                        {t.due_date && (
                          <span className="flex items-center gap-0.5">
                            <Clock className="h-2.5 w-2.5" />
                            {format(new Date(t.due_date), 'dd/MM', { locale: fr })}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Footer */}
                    <div className={`flex items-center border-t px-1.5 py-1 gap-0.5 ${isHovered || isSelected ? 'opacity-100' : 'opacity-100 sm:opacity-0'} transition-opacity duration-150`}>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={(ev) => { ev.stopPropagation(); setSelectedCard(t.id); }} title="Détails">
                        <Info className="h-3 w-3 text-gray-400" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-auto" onClick={(ev) => { ev.stopPropagation(); onTaskClick(t.id); }} title="Voir la checklist">
                        <ExternalLink className="h-3 w-3 text-blue-500" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Side panel */}
        {selectedTask && (
          <div className="w-80 sm:w-96 flex-shrink-0 bg-white border border-gray-200 rounded-xl ml-3 shadow-sm overflow-hidden flex flex-col"
            style={{ height: 'clamp(400px, calc(100vh - 340px), 800px)' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50/50 flex-shrink-0">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{selectedTask.is_phase_validation ? '🔒 ' : ''}{selectedTask.title}</p>
                <p className="text-[10px] text-muted-foreground">{COLUMN_CONFIG[selectedTask.kanban_column]?.label} · Projet {projectName}</p>
              </div>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setSelectedCard(null)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {selectedTask.is_phase_validation && <Badge className="text-[10px] bg-purple-100 text-purple-700 border-purple-200">🔒 Validation</Badge>}
                {!selectedTask.active && <Badge className="text-[10px] bg-gray-100 text-gray-500">Inactif</Badge>}
                <Badge className="text-[10px]">{COLUMN_CONFIG[selectedTask.kanban_column]?.icon} {COLUMN_CONFIG[selectedTask.kanban_column]?.label}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-[10px] text-muted-foreground mb-0.5">Assigné</p>
                  <p className="font-medium">{ASSIGNEE_ICONS[selectedTask.assignee] || '👤'} {selectedTask.assignee || '—'}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-[10px] text-muted-foreground mb-0.5">Priorité</p>
                  <p className={`font-medium ${PRIORITY_CONFIG[selectedTask.priority] || ''}`}><Zap className="h-3 w-3 inline mr-0.5" />{selectedTask.priority || '—'}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-[10px] text-muted-foreground mb-0.5">Échéance</p>
                  <p className="font-medium">{selectedTask.due_date ? format(new Date(selectedTask.due_date), 'dd MMM yyyy', { locale: fr }) : '—'}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-[10px] text-muted-foreground mb-0.5">Position</p>
                  <p className="font-medium">#{selectedTask.position}</p>
                </div>
              </div>
              {dependsOn && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs">
                  <p className="font-medium text-amber-700 mb-1">🔗 Dépend de</p>
                  <p className="text-amber-900">{dependsOn.title}</p>
                </div>
              )}
              {dependents.length > 0 && (
                <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs">
                  <p className="font-medium text-blue-700 mb-1">🔽 Bloque</p>
                  {dependents.map(d => <p key={d.id} className="text-blue-900">{d.title}</p>)}
                </div>
              )}
              {selectedTask.description && (
                <div className="border-t pt-3">
                  <p className="text-[10px] text-muted-foreground mb-1 uppercase">Description</p>
                  <p className="text-xs">{selectedTask.description}</p>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 px-4 py-3 border-t bg-gray-50/30 flex-shrink-0">
              <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => { setSelectedCard(null); onTaskClick(selectedTask.id); }}>
                <ExternalLink className="h-3 w-3 mr-1" /> Voir checklist
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between mt-2 text-[10px] text-muted-foreground">
        <span>🖱️ Ctrl+Molette = Zoom · Glissez · Clic = Détails</span>
        <span>Zoom {Math.round(zoom * 100)}% · {activeTasks.length} tâche{activeTasks.length !== 1 ? 's' : ''}</span>
      </div>
    </div>
  );
};
