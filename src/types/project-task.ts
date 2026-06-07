// Types pour les tâches Kanban — AssoAI Gestion de Projet v3

export type KanbanColumn = 'a_faire' | 'en_cours' | 'en_revision' | 'termine';

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export type TaskAssignee = 'technicien' | 'superviseur' | 'logistique' | 'commercial' | 'admin';

export type TaskCreator = 'user' | 'agent';

export interface ProjectTask {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  kanban_column: KanbanColumn;
  position: number;
  assignee?: TaskAssignee;
  assignee_contact?: string;
  due_date?: string;
  completed_at?: string;
  labels: string[];
  priority: TaskPriority;
  created_by: TaskCreator;
  created_at: string;
  updated_at: string;
}

export interface ProjectTaskFormData {
  title: string;
  description?: string;
  kanban_column?: KanbanColumn;
  assignee?: TaskAssignee;
  due_date?: string;
  priority?: TaskPriority;
  labels?: string[];
}
