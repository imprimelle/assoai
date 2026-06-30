import React, { useState, useEffect } from 'react';
import { ProjectTask, KanbanColumn, TaskPriority, TaskAssignee, ProjectTaskFormData } from '@/types/project-task';
import { useProjectTasks } from '@/hooks/useProjectTasks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from '@/components/ui/tooltip';
import { Plus, MoreHorizontal, Lock } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/integrations/supabase/client';

interface KanbanBoardProps {
  projectId: string;
  onTaskClick?: (taskId: string) => void;
  checklists?: any[]; // pour les photos de checklist
}

const COLUMNS: { id: KanbanColumn; label: string; color: string }[] = [
  { id: 'a_faire', label: 'À faire', color: 'border-t-gray-400' },
  { id: 'en_cours', label: 'En cours', color: 'border-t-blue-500' },
  { id: 'en_revision', label: 'En révision', color: 'border-t-orange-500' },
  { id: 'termine', label: 'Terminé', color: 'border-t-green-500' },
];

const PRIORITY_CONFIG: Record<TaskPriority, { color: string; label: string }> = {
  'low': { color: 'bg-gray-100 text-gray-600', label: 'Basse' },
  'medium': { color: 'bg-yellow-100 text-yellow-700', label: 'Moyenne' },
  'high': { color: 'bg-orange-100 text-orange-700', label: 'Haute' },
  'critical': { color: 'bg-red-100 text-red-700', label: 'Critique' },
};

const ASSIGNEE_CONFIG: Record<string, { label: string; icon: string }> = {
  'technicien': { label: 'Technicien', icon: '👤' },
  'superviseur': { label: 'Superviseur', icon: '👁️' },
  'logistique': { label: 'Logisticien', icon: '📦' },
  'commercial': { label: 'Commercial', icon: '💼' },
  'admin': { label: 'Admin', icon: '⚙️' },
  'chef_technique': { label: 'Chef technique', icon: '🔧' },
  'technicien_adjoint': { label: 'Technicien adjoint', icon: '🔩' },
  'superviseur_logistique': { label: 'Superviseur log.', icon: '📋' },
  'commerciale': { label: 'Commerciale', icon: '💼' },
  'directeur': { label: 'Directeur', icon: '👔' },
  'directrice_adjointe': { label: 'Directrice adjointe', icon: '👔' },
};

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ projectId, onTaskClick, checklists }) => {
  const { tasks, tasksByColumn, createTask, updateTask, deleteTask, isLoading } = useProjectTasks(projectId);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [addingToColumn, setAddingToColumn] = useState<KanbanColumn | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<KanbanColumn | null>(null);
  // 🆕 Galerie unifiée : photos depuis project_media par task_id
  const [projectMediaMap, setProjectMediaMap] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!projectId) return;
    supabase.from('project_media')
      .select('task_id, url')
      .eq('project_id', projectId)
      .eq('type', 'photo')
      .then(({ data, error }) => {
        if (error || !data) return;
        const map: Record<string, string[]> = {};
        for (const m of data) {
          if (!m.task_id) continue;
          if (!map[m.task_id]) map[m.task_id] = [];
          map[m.task_id].push(m.url);
        }
        setProjectMediaMap(map);
      });
  }, [projectId]);

  const handleCreateTask = (column: KanbanColumn) => {
    if (!newTaskTitle.trim()) return;
    createTask.mutate({
      project_id: projectId,
      title: newTaskTitle.trim(),
      kanban_column: column,
    });
    setNewTaskTitle('');
    setAddingToColumn(null);
  };

  const handleDragStart = (taskId: string) => {
    setDraggedTaskId(taskId);
  };

  const handleDragOver = (e: React.DragEvent, column: KanbanColumn) => {
    e.preventDefault();
    setDragOverColumn(column);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (column: KanbanColumn) => {
    setDragOverColumn(null);
    if (!draggedTaskId) return;

    // 🔒 Vérifier que la tâche peut être déplacée
    const task = tasks?.find(t => t.id === draggedTaskId);
    if (task && (!task.active || task.is_phase_validation)) {
      setDraggedTaskId(null);
      return;
    }

    updateTask.mutate({ id: draggedTaskId, kanban_column: column });
    setDraggedTaskId(null);
  };

  if (isLoading) {
    return <div className="flex justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-orange"></div>
    </div>;
  }

  return (
    <div className="flex overflow-x-auto gap-4 pb-4 snap-x snap-mandatory -mx-4 px-4 scrollbar-thin">
      {COLUMNS.map(col => {
        const colTasks = tasksByColumn[col.id] || [];
        const isAdding = addingToColumn === col.id;

        return (
          <div
            key={col.id}
            className={`flex-shrink-0 w-[280px] sm:w-[300px] snap-start bg-gray-50 rounded-lg border-t-4 ${col.color} min-h-[200px] transition-colors ${
              dragOverColumn === col.id ? 'bg-blue-50 ring-2 ring-brand-orange/30' : ''
            }`}
            onDragOver={(e) => handleDragOver(e, col.id)}
            onDragLeave={handleDragLeave}
            onDrop={() => handleDrop(col.id)}
          >
            {/* En-tête colonne */}
            <div className="flex items-center justify-between px-3 py-2">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-sm">{col.label}</h3>
                <Badge variant="secondary" className="text-xs">{colTasks.length}</Badge>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                onClick={() => { setAddingToColumn(col.id); setNewTaskTitle(''); }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Ajout rapide */}
            {isAdding && (
              <div className="px-3 pb-2">
                <Input
                  autoFocus
                  placeholder="Titre de la tâche..."
                  className="text-sm h-8"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateTask(col.id);
                    if (e.key === 'Escape') setAddingToColumn(null);
                  }}
                  onBlur={() => {
                    if (!newTaskTitle.trim()) setAddingToColumn(null);
                  }}
                />
                {newTaskTitle.trim() && (
                  <div className="flex gap-1 mt-1">
                    <Button size="sm" className="h-7 text-xs" onClick={() => handleCreateTask(col.id)}>
                      Ajouter
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAddingToColumn(null)}>
                      Annuler
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Cartes */}
            <div className="px-2 pb-2 space-y-2">
              {colTasks.map(task => {
                // 📸 Extraire les photos de la checklist liée + galerie unifiée project_media
                const taskChecklist = checklists?.find((cl: any) => cl.task_id === task.id);
                const unifiedPhotos = projectMediaMap[task.id] || [];
                let checklistPhotos: string[] = [];
                let hasMissingPhotos = false;
                if (taskChecklist?.items) {
                  for (const item of taskChecklist.items) {
                    const gallery = item.gallery_images || [];
                    if (item.image_url && !gallery.includes(item.image_url)) gallery.unshift(item.image_url);
                    checklistPhotos.push(...gallery);
                    if (item.required_image && item.done && gallery.length === 0) {
                      hasMissingPhotos = true;
                    }
                  }
                }
                // Fusionner : project_media d'abord (plus récent), puis checklist (dédoublonné)
                const allPhotos = [...unifiedPhotos, ...checklistPhotos.filter(u => !unifiedPhotos.includes(u))];
                return (
                <KanbanCard
                  key={task.id}
                  task={task}
                  onMove={(newCol) => updateTask.mutate({ id: task.id, kanban_column: newCol })}
                  onDelete={() => deleteTask.mutate(task.id)}
                  onClick={() => onTaskClick?.(task.id)}
                  onDragStart={handleDragStart}
                  isDragged={draggedTaskId === task.id}
                  checklistPhotos={allPhotos}
                  hasMissingPhotos={hasMissingPhotos}
                />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Carte de tâche individuelle
const KanbanCard: React.FC<{
  task: ProjectTask;
  onMove: (col: KanbanColumn) => void;
  onDelete: () => void;
  onClick?: () => void;
  onDragStart: (taskId: string) => void;
  isDragged?: boolean;
  checklistPhotos?: string[];
  hasMissingPhotos?: boolean;
}> = ({ task, onMove, onDelete, onClick, onDragStart, isDragged, checklistPhotos = [], hasMissingPhotos = false }) => {
  const priorityCfg = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG['medium'];
  const isOverdue = task.due_date && !task.completed_at && new Date(task.due_date) < new Date();
  const isMovable = task.active && !task.is_phase_validation;

  return (
    <div
      draggable={isMovable}
      onDragStart={(e) => {
        if (!isMovable) return;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', task.id);
        onDragStart(task.id);
      }}
      onDragEnd={() => onDragStart('')}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-dropdown]')) return;
        onClick?.();
      }}
      className={`bg-white rounded-md border p-3 shadow-sm hover:shadow-md transition-all ${
        isMovable ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
      } ${
        isOverdue ? 'border-red-300 ring-1 ring-red-200' : ''
      } ${isDragged ? 'opacity-50 scale-95' : ''} ${
        !task.active ? 'opacity-60 border-dashed border-gray-300 bg-gray-50/50' : ''
      } ${task.is_phase_validation && !task.active ? 'opacity-60 border-dashed border-purple-300 bg-purple-50/30' : ''} ${
        task.is_phase_validation && task.active ? 'border-purple-200 bg-purple-50/20' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {!isMovable && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[10px]">
                {!task.active
                  ? 'Tâche inactive — dépendance non résolue'
                  : 'Tâche de validation — non déplaçable'}
              </TooltipContent>
            </Tooltip>
          )}
          <p className="text-sm font-medium truncate">{task.title}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0" data-dropdown>
              <MoreHorizontal className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            {isMovable && COLUMNS.filter(c => c.id !== task.kanban_column).map(col => (
              <DropdownMenuItem key={col.id} onClick={() => onMove(col.id)}>
                → {col.label}
              </DropdownMenuItem>
            ))}
            {!isMovable && (
              <div className="px-2 py-1.5 text-[10px] text-muted-foreground italic">
                Déplacement verrouillé
              </div>
            )}
            <DropdownMenuItem className="text-red-500" onClick={onDelete}>
              Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        {!task.active && (
          <Badge variant="outline" className="text-[10px] border-gray-300 bg-gray-100 text-gray-500 gap-1">
            <Lock className="h-2.5 w-2.5" /> Inactive
          </Badge>
        )}
        {task.is_phase_validation && (
          <Badge className="text-[10px] bg-purple-100 text-purple-700 border-purple-200 gap-1">
            <Lock className="h-2.5 w-2.5" /> Validation
          </Badge>
        )}
        <Badge variant="secondary" className={`text-[10px] ${priorityCfg.color}`}>
          {priorityCfg.label}
        </Badge>
        {task.assignee && (
          <span className="text-xs text-muted-foreground">
            {ASSIGNEE_CONFIG[task.assignee]?.icon || '👤'} {ASSIGNEE_CONFIG[task.assignee]?.label || task.assignee}
          </span>
        )}
        {isOverdue && (
          <Badge variant="destructive" className="text-[10px]">En retard</Badge>
        )}
      </div>

      {task.due_date && (
        <p className={`text-xs mt-1.5 ${isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
          📅 {new Date(task.due_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
        </p>
      )}

      {/* 📸 Photos de la checklist */}
      {checklistPhotos.length > 0 && (
        <div className="flex gap-1 mt-2">
          {checklistPhotos.slice(0, 3).map((url, i) => (
            <img key={i} src={url} alt="" className="h-8 w-8 rounded object-cover border border-gray-200" />
          ))}
          {checklistPhotos.length > 3 && (
            <span className="text-xs text-muted-foreground self-end">+{checklistPhotos.length - 3}</span>
          )}
        </div>
      )}

      {/* ⚠️ Badge photo requise (tâche en révision + photos manquantes) */}
      {hasMissingPhotos && task.kanban_column === 'en_revision' && (
        <Badge className="text-[10px] bg-yellow-100 text-yellow-700 border-yellow-200 mt-1.5 gap-1">
          ⚠️ Photo requise
        </Badge>
      )}
    </div>
  );
};

// Ré-export pour usage externe
export const COLUMNS_FOR_MOVE = COLUMNS;
