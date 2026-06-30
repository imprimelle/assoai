import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Procedure, GenerationRules } from '@/hooks/useProcedures';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Link2, Unlink2, GripHorizontal, Pencil, Trash2,
  X, ArrowRight, Lock, Calendar, Zap, Plus,
  Smartphone, RefreshCw, Building2, Eye, GitBranch,
  Minus, Plus as PlusIcon, Expand, Shrink, Maximize2, Info,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

interface Position { x: number; y: number }

interface ProcedureLinkedBoxProps {
  procedures: Procedure[];
  onEdit: (p: Procedure) => void;
  onDelete: (id: string) => void;
  onLink: (sourceId: string, targetId: string) => void;
  onUnlink: (sourceId: string) => void;
  onCreate: () => void;
  onViewDetails: (p: Procedure) => React.ReactNode;
}

// ── Constants ──────────────────────────────────────────────────────────────

const CARD_W = 240;
const CARD_H = 135;
const CANVAS_SIZE = 3000;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.1;

const MODE_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string; bg: string; border: string }> = {
  statique:       { icon: <Smartphone className="h-3 w-3" />,  label: 'Statique',       color: 'text-blue-600',  bg: 'bg-blue-50',  border: 'border-blue-200' },
  projection_cdc: { icon: <RefreshCw className="h-3 w-3" />,   label: 'Proj. CDC',      color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
  par_enseigne:   { icon: <Building2 className="h-3 w-3" />,   label: 'Par enseigne',   color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
};

const PRIORITY_CONFIG: Record<string, string> = {
  low: 'text-gray-400', medium: 'text-yellow-500', high: 'text-orange-500', critical: 'text-red-500',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Basse', medium: 'Moyenne', high: 'Haute', critical: 'Critique',
};

const ASSIGNEE_ICONS: Record<string, string> = {
  commerciale: '💼', chef_technique: '🔧', technicien_adjoint: '🔩',
  superviseur_logistique: '📋', directeur: '👔', directrice_adjointe: '👩‍💼',
};

// ── Helpers ────────────────────────────────────────────────────────────────

function getModeConfig(rules: GenerationRules | null) {
  const mode = rules?.mode || 'statique';
  return MODE_CONFIG[mode] || MODE_CONFIG.statique;
}

function resolveProcedureTitle(p: Procedure): string {
  if (p.generation_rules?.mode === 'par_enseigne' && p.generation_rules.title_template) {
    return `🏗️ ${p.generation_rules.title_template}`;
  }
  return p.task_title;
}

// ── Storage ────────────────────────────────────────────────────────────────

const POS_STORAGE_KEY = 'procedure-linked-box-positions';

function loadPositions(): Record<string, Position> {
  try {
    const raw = localStorage.getItem(POS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function savePositions(pos: Record<string, Position>) {
  localStorage.setItem(POS_STORAGE_KEY, JSON.stringify(pos));
}

// ── Local helpers (must be before component) ────────────────────────────

const PHASE_LABELS_FOR_PANEL: Record<string, string> = {
  'Statique': '📋 Statique',
  'Proj. CDC': '🔄 Projection CDC',
  'Par enseigne': '🏗️ Par enseigne',
};

const GEN_MODE_SHORT: Record<string, string> = {
  statique: '📋 Fixe',
  projection_cdc: '🔄 CDC',
  par_enseigne: '🏗️ Ens.',
};

// ── Component ──────────────────────────────────────────────────────────────

export const ProcedureLinkedBox: React.FC<ProcedureLinkedBoxProps> = ({
  procedures, onEdit, onDelete, onLink, onUnlink, onCreate, onViewDetails,
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState<Record<string, Position>>(() => loadPositions());
  // Refs for synchronous drag state (state is async → touchmove arrives before re-render)
  const draggingRef = useRef<string | null>(null);
  const dragOffsetRef = useRef<Position>({ x: 0, y: 0 });
  const [, setDragTick] = useState(0); // counter to force re-render for visual drag state
  const [linkingFrom, setLinkingFrom] = useState<string | null>(null);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [hoveredLink, setHoveredLink] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);

  const selectedProcedure = selectedCard ? procedures.find(p => p.id === selectedCard) : null;

  // ── Auto-layout for new procedures ─────────────────────────────────────

  useEffect(() => {
    setPositions(prev => {
      const updated = { ...prev };
      let changed = false;
      const ordered = [...procedures].sort((a, b) => a.order - b.order);
      const PADDING = 50;

      const depth = new Map<string, number>();
      const getDepth = (p: Procedure, path: Set<string> = new Set()): number => {
        if (depth.has(p.id)) return depth.get(p.id)!;
        if (path.has(p.id)) return 0; // cycle détecté → profondeur 0
        path.add(p.id);
        const dep = procedures.find(x => x.id === p.depends_on_procedure_id);
        const d = dep ? getDepth(dep, path) + 1 : 0;
        depth.set(p.id, d);
        return d;
      };
      ordered.forEach(p => getDepth(p));

      const byDepth = new Map<number, Procedure[]>();
      ordered.forEach(p => {
        const d = depth.get(p.id) || 0;
        if (!byDepth.has(d)) byDepth.set(d, []);
        byDepth.get(d)!.push(p);
      });

      Array.from(byDepth.keys()).sort((a, b) => a - b).forEach(d => {
        const row = byDepth.get(d)!;
        const colW = CARD_W + 30;
        const rowH = CARD_H + 16;
        row.forEach((p, i) => {
          if (!(p.id in updated)) {
            updated[p.id] = {
              x: PADDING + d * colW,
              y: PADDING + i * rowH,
            };
            changed = true;
          }
        });
      });

      if (changed) savePositions(updated);
      return updated;
    });
  }, [procedures]);

  // ── Compute fit zoom ───────────────────────────────────────────────────

  const fitZoom = useMemo(() => {
    if (procedures.length === 0) return 1;
    let maxX = 0, maxY = 0;
    procedures.forEach(p => {
      const pos = positions[p.id];
      if (!pos) return;
      maxX = Math.max(maxX, pos.x + CARD_W + 60);
      maxY = Math.max(maxY, pos.y + CARD_H + 60);
    });
    const vw = typeof window !== 'undefined' ? window.innerWidth - 48 : 800;
    const vh = typeof window !== 'undefined' ? window.innerHeight - 360 : 500;
    const zx = vw / maxX;
    const zy = vh / maxY;
    return Math.min(zx, zy, 1);
  }, [procedures, positions]);

  const handleFitToScreen = () => setZoom(fitZoom);

  // ── Auto-fit on first mount ──────────────────────────────────────────
  const hasAutoFit = useRef(false);
  useEffect(() => {
    if (!hasAutoFit.current && procedures.length > 0) {
      hasAutoFit.current = true;
      const t = setTimeout(() => setZoom(fitZoom), 100);
      return () => clearTimeout(t);
    }
  }, [fitZoom, procedures.length]);

  // ── Zoom handlers ──────────────────────────────────────────────────────

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setZoom(z => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z + delta)));
  }, []);

  const zoomIn = () => setZoom(z => Math.min(MAX_ZOOM, z + ZOOM_STEP));
  const zoomOut = () => setZoom(z => Math.max(MIN_ZOOM, z - ZOOM_STEP));
  const zoomReset = () => setZoom(1);

  // ── Pinch zoom state ───────────────────────────────────────────────────

  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null);
  const dragEndRef = useRef<(() => void) | null>(null);
  const dragMoved = useRef(false);  // tracks whether a drag actually moved (to suppress ghost clicks)
  const [expanded, setExpanded] = useState(false);

  const getTouchDist = (touches: React.TouchList): number => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // ── Drag handlers (mouse + touch) ──────────────────────────────────────

  const getEventPos = (e: React.MouseEvent | React.TouchEvent): { clientX: number; clientY: number } => {
    if ('touches' in e) {
      return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
    }
    return { clientX: e.clientX, clientY: e.clientY };
  };

  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent, procId: string) => {
    if ('touches' in e && e.touches.length !== 1) return;
    e.preventDefault();
    // Don't start drag if clicking on action buttons
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;
    const card = (e.target as HTMLElement).closest('[data-card]')?.getBoundingClientRect();
    if (!card) return;
    const pos = getEventPos(e);
    draggingRef.current = procId;
    dragOffsetRef.current = { x: pos.clientX - card.left, y: pos.clientY - card.top };
    dragMoved.current = false;
    setDragTick(n => n + 1); // force re-render for visual state
  }, []);

  const handleDragMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!draggingRef.current || !canvasRef.current) return;
    if ('touches' in e && e.touches.length !== 1) { dragEndRef.current?.(); return; }
    e.preventDefault();
    const canvas = canvasRef.current.getBoundingClientRect();
    const pos = getEventPos(e);
    const x = (pos.clientX - canvas.left) / zoom - dragOffsetRef.current.x;
    const y = (pos.clientY - canvas.top) / zoom - dragOffsetRef.current.y;
    // Only mark as moved if travelled > 3px
    const currentPos = positions[draggingRef.current];
    if (currentPos) {
      const dx = Math.abs(x - currentPos.x);
      const dy = Math.abs(y - currentPos.y);
      if (dx > 3 || dy > 3) dragMoved.current = true;
    }
    setPositions(prev => ({ ...prev, [draggingRef.current!]: { x: Math.max(0, x), y: Math.max(0, y) } }));
  }, [zoom, positions]);

  const handleDragEnd = useCallback(() => {
    if (draggingRef.current) {
      savePositions({ ...positions });
      draggingRef.current = null;
      setDragTick(n => n + 1);
    }
  }, [positions]);

  dragEndRef.current = handleDragEnd;

  // ── Canvas-level touch: pinch zoom + card drag ─────────────────────────

  const handleCanvasTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Two fingers → start pinch zoom, prevent browser from handling
      e.preventDefault();
      pinchRef.current = { dist: getTouchDist(e.touches), zoom };
      dragMoved.current = false;
    } else if (e.touches.length === 1) {
      // Single finger on canvas background (not on a card) → allow native scroll
      pinchRef.current = null;
    }
  };

  const handleCanvasTouchMove = (e: React.TouchEvent) => {
    // Pinch zoom (2 fingers)
    if (pinchRef.current && e.touches.length === 2) {
      e.preventDefault();
      const newDist = getTouchDist(e.touches);
      const scale = newDist / pinchRef.current.dist;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinchRef.current.zoom * scale));
      setZoom(Math.round(newZoom * 100) / 100);
      return;
    }
    // Card drag (1 finger + dragging state) — replaces onMouseMove for mobile
    if (draggingRef.current && e.touches.length === 1 && canvasRef.current) {
      e.preventDefault();
      const canvas = canvasRef.current.getBoundingClientRect();
      const pos = { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
      const x = (pos.clientX - canvas.left) / zoom - dragOffsetRef.current.x;
      const y = (pos.clientY - canvas.top) / zoom - dragOffsetRef.current.y;
      // Only mark as moved if the finger actually travelled > 3px
      const currentPos = positions[draggingRef.current];
      if (currentPos) {
        const dx = Math.abs(x - currentPos.x);
        const dy = Math.abs(y - currentPos.y);
        if (dx > 3 || dy > 3) dragMoved.current = true;
      }
      setPositions(prev => ({ ...prev, [draggingRef.current!]: { x: Math.max(0, x), y: Math.max(0, y) } }));
    }
    // Otherwise let native scroll happen (single finger on canvas bg)
  };
  const handleCanvasTouchEnd = () => {
    pinchRef.current = null;
    // End any ongoing drag on touch end (mobile)
    if (draggingRef.current) {
      savePositions({ ...positions });
      draggingRef.current = null;
      setDragTick(n => n + 1);
    }
  };

  // ── Link handlers ──────────────────────────────────────────────────────

  const handleStartLink = (sourceId: string) => setLinkingFrom(sourceId);
  const handleTargetClick = (targetId: string) => {
    if (linkingFrom && linkingFrom !== targetId) onLink(linkingFrom, targetId);
    setLinkingFrom(null);
  };
  const handleCanvasClick = () => { setLinkingFrom(null); setSelectedCard(null); };
  const handleDeleteLink = (procId: string) => onUnlink(procId);

  // ── Card detail panel ──────────────────────────────────────────────────

  const dependsOn = selectedProcedure
    ? procedures.find(x => x.id === selectedProcedure.depends_on_procedure_id)
    : null;

  const dependents = selectedProcedure
    ? procedures.filter(x => x.depends_on_procedure_id === selectedProcedure.id)
    : [];

  // ── SVG arrows ─────────────────────────────────────────────────────────

  const renderArrows = () => {
    const arrows: React.ReactNode[] = [];
    procedures.forEach(p => {
      if (!p.depends_on_procedure_id) return;
      const source = positions[p.depends_on_procedure_id];
      const target = positions[p.id];
      if (!source || !target) return;

      const sx = source.x + CARD_W;
      const sy = source.y + CARD_H / 2;
      const tx = target.x;
      const ty = target.y + CARD_H / 2;
      const midX = (sx + tx) / 2;

      const isHovered = hoveredLink === p.id;
      const isSelected = selectedCard === p.id || selectedCard === p.depends_on_procedure_id;
      const arrowColor = isHovered ? '#f97316' : isSelected ? '#6366f1' : '#94a3b8';
      const arrowWidth = isHovered || isSelected ? 2.5 : 1.5;

      arrows.push(
        <g key={`arrow-${p.id}`}
          onMouseEnter={() => setHoveredLink(p.id)}
          onMouseLeave={() => setHoveredLink(null)}
          style={{ cursor: 'pointer' }}
        >
          <path
            d={`M ${sx} ${sy} C ${midX} ${sy}, ${midX} ${ty}, ${tx} ${ty}`}
            fill="none" stroke="transparent" strokeWidth={14}
          />
          <path
            d={`M ${sx} ${sy} C ${midX} ${sy}, ${midX} ${ty}, ${tx} ${ty}`}
            fill="none" stroke={arrowColor} strokeWidth={arrowWidth}
            markerEnd={`url(#arrowhead-${isHovered ? 'hover' : 'normal'})`}
            className="transition-all duration-150"
          />
          <circle
            cx={midX} cy={(sy + ty) / 2} r={14}
            fill={isHovered ? '#fef2f2' : 'transparent'}
            stroke={isHovered ? '#fecaca' : 'transparent'}
            strokeWidth={1.5}
            className="transition-all duration-150"
            onClick={(e) => { e.stopPropagation(); handleDeleteLink(p.id); }}
          />
          {isHovered && (
            <g transform={`translate(${midX - 10}, ${(sy + ty) / 2 - 10})`}>
              <circle r={14} fill="#fee2e2" stroke="#fca5a5" strokeWidth={1.5} />
              <text x={0} y={1} textAnchor="middle" dominantBaseline="middle" fontSize={12}>✕</text>
            </g>
          )}
        </g>
      );
    });
    return arrows;
  };

  const renderLinkingLine = () => {
    if (!linkingFrom || !positions[linkingFrom]) return null;
    const src = positions[linkingFrom];
    return (
      <line
        x1={src.x + CARD_W} y1={src.y + CARD_H / 2}
        x2={src.x + CARD_W + 50} y2={src.y + CARD_H / 2}
        stroke="#f97316" strokeWidth={2} strokeDasharray="6 4"
        className="animate-pulse"
      />
    );
  };

  const GRID_SIZE = 40;
  const renderGrid = () => {
    if (!showGrid) return null;
    const dots: React.ReactNode[] = [];
    const MAX = CANVAS_SIZE;
    for (let x = GRID_SIZE; x < MAX; x += GRID_SIZE) {
      for (let y = GRID_SIZE; y < MAX; y += GRID_SIZE) {
        dots.push(<circle key={`${x}-${y}`} cx={x} cy={y} r={1} fill="#d1d5db" />);
      }
    }
    return <g>{dots}</g>;
  };

  // ── Empty state ────────────────────────────────────────────────────────

  if (procedures.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
          <GitBranch className="h-8 w-8 text-gray-400" />
        </div>
        <p className="text-sm font-medium text-gray-600 mb-1">Aucune procédure</p>
        <p className="text-xs text-muted-foreground mb-4 max-w-xs">
          Créez votre première procédure pour cette phase. Les procédures seront affichées comme des cartes liées dans ce canvas.
        </p>
        <Button onClick={onCreate} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Nouvelle procédure
        </Button>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="relative">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 px-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Create button */}
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onCreate}>
            <Plus className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">Nouvelle</span>
          </Button>

          <div className="w-px h-5 bg-gray-200 mx-0.5" />

          {/* Zoom controls */}
          <div className="flex items-center gap-0 bg-white border rounded-lg shadow-sm">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-r-none" onClick={zoomOut} title="Zoom arrière">
              <Minus className="h-3 w-3" />
            </Button>
            <span className="text-[10px] font-medium tabular-nums w-10 text-center select-none">
              {Math.round(zoom * 100)}%
            </span>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-l-none" onClick={zoomIn} title="Zoom avant">
              <PlusIcon className="h-3 w-3" />
            </Button>
          </div>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleFitToScreen} title="Ajuster à l'écran">
            <Maximize2 className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">Ajuster</span>
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={zoomReset} title="Zoom 100%">
            1:1
          </Button>

          <div className="w-px h-5 bg-gray-200 mx-1 hidden xs:block" />

          <Button variant="ghost" size="sm" className="h-7 text-xs"
            onClick={() => setExpanded(!expanded)} title={expanded ? 'Réduire' : 'Plein écran'}>
            {expanded ? <Shrink className="h-3 w-3 sm:mr-1" /> : <Expand className="h-3 w-3 sm:mr-1" />}
            <span className="hidden sm:inline">{expanded ? 'Réduire' : 'Plein écran'}</span>
          </Button>

          <Button variant={showGrid ? 'secondary' : 'ghost'} size="sm"
            onClick={() => setShowGrid(!showGrid)} className="text-xs h-7">
            <Eye className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">Grille</span>
          </Button>

          {linkingFrom && (
            <Badge className="bg-orange-100 text-orange-700 border-orange-200 gap-1 animate-pulse text-[10px]">
              <Link2 className="h-3 w-3" />
              Cliquez une cible
              <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => setLinkingFrom(null)} />
            </Badge>
          )}
        </div>

        {/* Legend */}
        <div className="hidden sm:flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1"><Smartphone className="h-3 w-3 text-blue-500" /> Statique</span>
          <span className="flex items-center gap-1"><RefreshCw className="h-3 w-3 text-green-500" /> Proj.</span>
          <span className="flex items-center gap-1"><Building2 className="h-3 w-3 text-purple-500" /> Ens.</span>
          <span className="flex items-center gap-1"><Lock className="h-3 w-3 text-red-500" /> Valid.</span>
        </div>
      </div>

      {/* Canvas + Side panel */}
      <div className="flex gap-0">
        {/* Canvas */}
        <div
          ref={canvasRef}
          className="relative rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 overflow-auto select-none flex-1"
          style={{
            minHeight: 400,
            height: expanded
              ? 'calc(100vh - 200px)'
              : 'clamp(400px, calc(100vh - 340px), 800px)',
            touchAction: 'pan-x pan-y',
          }}
          onWheel={handleWheel}
          onMouseMove={(e) => handleDragMove(e)}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
          onTouchStart={handleCanvasTouchStart}
          onTouchMove={handleCanvasTouchMove}
          onTouchEnd={handleCanvasTouchEnd}
          onClick={handleCanvasClick}
        >
          {/* Zoom transform wrapper */}
          <div
            className="relative"
            style={{
              width: CANVAS_SIZE,
              height: CANVAS_SIZE,
              transform: `scale(${zoom})`,
              transformOrigin: '0 0',
            }}
          >
            {/* SVG layer */}
            <svg
              className="absolute inset-0 pointer-events-none"
              style={{ width: CANVAS_SIZE, height: CANVAS_SIZE, zIndex: 1 }}
            >
              <defs>
                <marker id="arrowhead-normal" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
                </marker>
                <marker id="arrowhead-hover" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#f97316" />
                </marker>
              </defs>
              {renderGrid()}
              <g style={{ pointerEvents: 'auto' }}>
                {renderArrows()}
                {renderLinkingLine()}
              </g>
            </svg>

            {/* Cards layer */}
            <div className="absolute inset-0" style={{ zIndex: 2 }}>
              {procedures.map(p => {
                const pos = positions[p.id] || { x: 0, y: 0 };
                const modeCfg = getModeConfig(p.generation_rules);
                const isDragging = draggingRef.current === p.id;
                const isSource = linkingFrom === p.id;
                const isTargetable = linkingFrom !== null && linkingFrom !== p.id;
                const isHovered = hoveredCard === p.id;
                const isSelected = selectedCard === p.id;
                const cardDep = procedures.find(x => x.id === p.depends_on_procedure_id);

                return (
                  <div
                    key={p.id}
                    data-card={p.id}
                    className={`absolute bg-white rounded-xl border shadow-sm overflow-hidden cursor-pointer
                      ${isDragging ? 'shadow-2xl scale-105 z-50 opacity-90' : ''}
                      ${isSource ? 'ring-2 ring-orange-400 ring-offset-2 z-40' : ''}
                      ${isTargetable ? 'cursor-crosshair hover:ring-2 hover:ring-orange-300' : ''}
                      ${isHovered && !isDragging ? 'shadow-lg' : ''}
                      ${isSelected ? 'ring-2 ring-indigo-400 ring-offset-2 z-30' : ''}
                      ${p.is_phase_validation ? 'border-red-300 bg-red-50/30' : modeCfg.border}
                      transition-all duration-150
                    `}
                    style={{
                      left: pos.x,
                      top: pos.y,
                      width: CARD_W,
                      zIndex: isDragging ? 50 : isSource ? 40 : isSelected ? 30 : 3,
                    }}
                    onMouseEnter={() => setHoveredCard(p.id)}
                    onMouseLeave={() => setHoveredCard(null)}
                    onMouseDown={(e) => handleDragStart(e, p.id)}
                    onTouchStart={(e) => handleDragStart(e, p.id)}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isTargetable) {
                        handleTargetClick(p.id);
                      } else if (!dragMoved.current) {
                        setSelectedCard(isSelected ? null : p.id);
                      }
                      dragMoved.current = false;
                    }}
                  >
                    {/* Header */}
                    <div
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 border-b
                        ${p.is_phase_validation ? 'bg-red-100/60' : modeCfg.bg}`}
                    >
                      <GripHorizontal className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className={`text-[9px] font-medium flex items-center gap-1 truncate ${modeCfg.color}`}>
                        {modeCfg.icon} {modeCfg.label}
                      </span>
                      {p.is_phase_validation && (
                        <Badge className="text-[8px] bg-red-100 text-red-700 border-red-200 px-1 py-0 leading-none ml-auto">
                          🔒 Val.
                        </Badge>
                      )}
                      <span className="text-[8px] text-muted-foreground ml-auto flex-shrink-0">#{p.order}</span>
                    </div>

                    {/* Content */}
                    <div className="px-2.5 py-2">
                      {cardDep && (
                        <div className="flex items-center gap-1 mb-1.5 text-[9px] text-muted-foreground">
                          <ArrowRight className="h-2.5 w-2.5 text-blue-400 flex-shrink-0" />
                          <span className="truncate">← {resolveProcedureTitle(cardDep).substring(0, 28)}</span>
                        </div>
                      )}
                      <p className={`text-xs font-semibold leading-tight mb-1.5 line-clamp-2 ${p.is_phase_validation ? 'text-red-700' : ''}`}>
                        {p.is_phase_validation ? '🔒 ' : ''}{resolveProcedureTitle(p)}
                      </p>
                      <div className="flex flex-wrap items-center gap-1 text-[9px] text-muted-foreground">
                        {p.task_assignee && (
                          <span>{ASSIGNEE_ICONS[p.task_assignee] || '👤'} {p.task_assignee}</span>
                        )}
                        {p.task_due_days != null && <span>· {p.task_due_days}j</span>}
                        {p.task_priority && (
                          <Zap className={`h-2.5 w-2.5 ${PRIORITY_CONFIG[p.task_priority] || ''}`} />
                        )}
                        {p.required_image && <span>· 📸</span>}
                      </div>
                      {p.checklist_title && (
                        <p className="text-[9px] text-muted-foreground mt-1 truncate">📋 {p.checklist_title}</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className={`flex items-center border-t px-1.5 py-1 gap-0.5
                      ${isHovered || isSource || isSelected ? 'opacity-100' : 'opacity-100 sm:opacity-0'}
                      transition-opacity duration-150`}>
                      {!p.is_phase_validation && (
                        <>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0"
                            onClick={(ev) => { ev.stopPropagation(); handleStartLink(p.id); }} title="Lier">
                            <Link2 className="h-3 w-3 text-blue-500" />
                          </Button>
                          {p.depends_on_procedure_id && (
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0"
                              onClick={(ev) => { ev.stopPropagation(); handleDeleteLink(p.id); }} title="Délier">
                              <Unlink2 className="h-3 w-3 text-red-400" />
                            </Button>
                          )}
                        </>
                      )}
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-auto"
                        onClick={(ev) => { ev.stopPropagation(); setSelectedCard(p.id); }} title="Détails">
                        <Info className="h-3 w-3 text-gray-400" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0"
                        onClick={(ev) => { ev.stopPropagation(); onEdit(p); }} title="Modifier">
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0"
                        onClick={(ev) => { ev.stopPropagation(); onDelete(p.id); }} title="Supprimer">
                        <Trash2 className="h-3 w-3 text-red-400" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Detail side panel */}
        {selectedProcedure && (
          <div className="w-80 sm:w-96 flex-shrink-0 bg-white border border-gray-200 rounded-xl ml-3 shadow-sm overflow-hidden flex flex-col"
            style={{
              height: expanded ? 'calc(100vh - 200px)' : 'clamp(400px, calc(100vh - 340px), 800px)',
            }}>
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50/50 flex-shrink-0">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">
                  {selectedProcedure.is_phase_validation ? '🔒 ' : ''}{resolveProcedureTitle(selectedProcedure)}
                </p>
                <p className="text-[10px] text-muted-foreground">#{selectedProcedure.order} · {PHASE_LABELS_FOR_PANEL[getModeConfig(selectedProcedure.generation_rules).label] || getModeConfig(selectedProcedure.generation_rules).label}</p>
              </div>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setSelectedCard(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Panel content */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {/* Meta badges */}
              <div className="flex flex-wrap gap-1.5">
                {selectedProcedure.is_phase_validation && (
                  <Badge className="text-[10px] bg-purple-100 text-purple-700 border-purple-200">🔒 Validation</Badge>
                )}
                {selectedProcedure.generation_rules && (
                  <Badge className={`text-[10px] ${
                    selectedProcedure.generation_rules.mode === 'projection_cdc' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                    selectedProcedure.generation_rules.mode === 'par_enseigne' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                    'bg-gray-100 text-gray-600 border-gray-200'
                  }`}>
                    {GEN_MODE_SHORT[selectedProcedure.generation_rules.mode] || selectedProcedure.generation_rules.mode}
                  </Badge>
                )}
                {selectedProcedure.required_image && (
                  <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200">📸 Photos</Badge>
                )}
              </div>

              {/* Quick info */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-[10px] text-muted-foreground mb-0.5">Assigné</p>
                  <p className="font-medium">{ASSIGNEE_ICONS[selectedProcedure.task_assignee] || '👤'} {selectedProcedure.task_assignee}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-[10px] text-muted-foreground mb-0.5">Priorité</p>
                  <p className={`font-medium ${PRIORITY_CONFIG[selectedProcedure.task_priority] || ''}`}>
                    <Zap className="h-3 w-3 inline mr-0.5" />
                    {PRIORITY_LABELS[selectedProcedure.task_priority] || selectedProcedure.task_priority}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-[10px] text-muted-foreground mb-0.5">Délai</p>
                  <p className="font-medium"><Calendar className="h-3 w-3 inline mr-0.5" />{selectedProcedure.task_due_days} jours</p>
                </div>
                {selectedProcedure.checklist_title && (
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-[10px] text-muted-foreground mb-0.5">Checklist</p>
                    <p className="font-medium truncate">📋 {selectedProcedure.checklist_title}</p>
                  </div>
                )}
              </div>

              {/* Dependencies */}
              {dependsOn && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs">
                  <p className="font-medium text-amber-700 mb-1">🔗 Dépend de</p>
                  <p className="text-amber-900">{resolveProcedureTitle(dependsOn)}</p>
                  {selectedProcedure.depends_description && (
                    <p className="text-amber-700 mt-1 italic">{selectedProcedure.depends_description}</p>
                  )}
                </div>
              )}
              {dependents.length > 0 && (
                <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs">
                  <p className="font-medium text-blue-700 mb-1">🔽 Bloque</p>
                  {dependents.map(d => (
                    <p key={d.id} className="text-blue-900">{resolveProcedureTitle(d)}</p>
                  ))}
                </div>
              )}

              {/* Detail content from parent (instructions, rules, items) */}
              <div className="border-t pt-3">
                {onViewDetails(selectedProcedure)}
              </div>
            </div>

            {/* Panel actions */}
            <div className="flex items-center gap-2 px-4 py-3 border-t bg-gray-50/30 flex-shrink-0">
              <Button variant="outline" size="sm" className="flex-1 text-xs"
                onClick={() => { setSelectedCard(null); onEdit(selectedProcedure); }}>
                <Pencil className="h-3 w-3 mr-1" /> Modifier
              </Button>
              <Button variant="outline" size="sm" className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
                onClick={() => { const id = selectedProcedure.id; setSelectedCard(null); onDelete(id); }}>
                <Trash2 className="h-3 w-3 mr-1" /> Supprimer
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Hint */}
      <div className="flex flex-wrap items-center justify-between mt-2 text-[10px] text-muted-foreground">
        <span className="hidden sm:inline">
          🖱️ Ctrl+Molette = Zoom · Glissez pour déplacer · 🔗 = Créer lien · Clic = Détails
        </span>
        <span className="sm:hidden text-center w-full">
          ↕️ Glissez · 🔗 Lier · Pincez pour zoomer · Tapez = Détails
        </span>
        <span>Zoom {Math.round(zoom * 100)}% · {procedures.length} procédure{procedures.length !== 1 ? 's' : ''}</span>
      </div>
    </div>
  );
};
