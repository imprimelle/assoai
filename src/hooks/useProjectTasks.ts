import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ProjectTask, ProjectTaskFormData, KanbanColumn } from '@/types/project-task';
import { useToast } from '@/hooks/use-toast';
import { appLogger } from '@/utils/logger';

export const useProjectTasks = (projectId?: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch all tasks for a project
  const { data: tasks, isLoading, error } = useQuery({
    queryKey: ['project-tasks', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      
      const { data, error } = await supabase
        .from('project_tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('position', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);
      return (data || []) as ProjectTask[];
    },
    enabled: !!projectId,
  });

  // Create a new task
  const createTask = useMutation({
    mutationFn: async (form: ProjectTaskFormData & { project_id: string }) => {
      const { data, error } = await supabase
        .from('project_tasks')
        .insert({
          project_id: form.project_id,
          title: form.title,
          description: form.description,
          kanban_column: form.kanban_column || 'a_faire',
          assignee: form.assignee,
          due_date: form.due_date,
          priority: form.priority || 'medium',
          labels: form.labels || [],
          created_by: 'user',
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data as ProjectTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] });
      toast({ title: 'Tâche créée', description: 'La tâche a été ajoutée au Kanban.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  // Update a task (move column, edit, etc.)
  const updateTask = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ProjectTask> & { id: string }) => {
      // If moving to 'termine', set completed_at
      const patch: Record<string, unknown> = { ...updates };
      if (updates.kanban_column === 'termine') {
        patch.completed_at = new Date().toISOString();
      }
      if (updates.kanban_column && updates.kanban_column !== 'termine') {
        patch.completed_at = null;
      }

      const { data, error } = await supabase
        .from('project_tasks')
        .update(patch)
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data as ProjectTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  // Delete a task
  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('project_tasks')
        .delete()
        .eq('id', id);

      if (error) throw new Error(error.message);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] });
      toast({ title: 'Tâche supprimée' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  // Tasks grouped by column
  const tasksByColumn = (tasks || []).reduce((acc, task) => {
    const col = task.kanban_column || 'a_faire';
    if (!acc[col]) acc[col] = [];
    acc[col].push(task);
    return acc;
  }, {} as Record<KanbanColumn, ProjectTask[]>);

  return {
    tasks,
    tasksByColumn,
    isLoading,
    error,
    createTask,
    updateTask,
    deleteTask,
  };
};
