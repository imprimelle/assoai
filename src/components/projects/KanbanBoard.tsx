import React, { useState } from 'react';
import { ProjectTask, KanbanColumn, TaskPriority, TaskAssignee, ProjectTaskFormData } from '@/types/project-task';
import { useProjectTasks } from '@/hooks/useProjectTasks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { v4 as uuidv4 } from 'uuid';

interface KanbanBoardProps {
  projectId: string;
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

const ASSIGNEE_CONFIG: Record<TaskAssignee, { label: string; icon: string }> = {
  'technicien': { label: 'Technicien', icon: '👤' },
  'superviseur': { label: 'Superviseur', icon: '👁️' },
  'logistique': { label: 'Logisticien', icon: '📦' },
  'commercial': { label: 'Commercial', icon: '💼' },
  'admin': { label: 'Admin', icon: '⚙️' },
};

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ projectId }) => {
  const { tasks, tasksByColumn, createTask, updateTask, deleteTask, isLoading } = useProjectTasks(projectId);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [addingToColumn, setAddingToColumn] = useState<KanbanColumn | null>(null);

  const handleCreateTask = (column: KanbanColumn) => {
    if (!newTaskTitle.trim()) return;
    createTask.mutate({
      project_id: projectId,
      title: newTaskTitle.trim(),
      kanban_column,
    });
    setNewTaskTitle('');
    setAddingToColumn(null);
  };

  if (isLoading) {
    return <div className="flex justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-orange"></div>
    </div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto pb-4">
      {COLUMNS.map(col => {
        const colTasks = tasksByColumn[col.id] || [];
        const isAdding = addingToColumn === col.id;

        return (
          <div key={col.id} className={`bg-gray-50 rounded-lg border-t-4 ${col.color} min-h-[200px]`}>
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
              {colTasks.map(task => (
                <KanbanCard
                  key={task.id}
                  task={task}
                  onMove={(newCol) => updateTask.mutate({ id: task.id, kanban_column: newCol })}
                  onDelete={() => deleteTask.mutate(task.id)}
                />
              ))}
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
}> = ({ task, onMove, onDelete }) => {
  const priorityCfg = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG['medium'];
  const isOverdue = task.due_date && !task.completed_at && new Date(task.due_date) < new Date();

  return (
    <div className={`bg-white rounded-md border p-3 shadow-sm hover:shadow-md transition-shadow ${isOverdue ? 'border-red-300 ring-1 ring-red-200' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium flex-1">{task.title}</p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0">
              <MoreHorizontal className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            {COLUMNS.filter(c => c.id !== task.kanban_column).map(col => (
              <DropdownMenuItem key={col.id} onClick={() => onMove(col.id)}>
                → {col.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem className="text-red-500" onClick={onDelete}>
              Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        <Badge variant="secondary" className={`text-xs ${priorityCfg.color}`}>
          {priorityCfg.label}
        </Badge>
        {task.assignee && ASSIGNEE_CONFIG[task.assignee] && (
          <span className="text-xs text-muted-foreground">
            {ASSIGNEE_CONFIG[task.assignee].icon}
          </span>
        )}
        {isOverdue && (
          <Badge variant="destructive" className="text-xs">En retard</Badge>
        )}
      </div>

      {task.due_date && (
        <p className={`text-xs mt-1.5 ${isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
          📅 {new Date(task.due_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
        </p>
      )}
    </div>
  );
};

// Ré-export pour usage externe
export const COLUMNS_FOR_MOVE = COLUMNS;
