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
        .eq('active', true)
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
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] });

      const newColumn = variables.kanban_column;
      if (!newColumn || !projectId) return;

      // 🔔 Synchro Communicateur : déplacement Kanban → notifications + synchro checklist
      const taskId = variables.id;
      const movedToEnCours = newColumn === 'en_cours';
      const movedToTermine = newColumn === 'termine';
      if (!movedToEnCours && !movedToTermine) return;

      // Mapping rôles → noms humains (identique à ChecklistSlide.tsx)
      const ROLE_NAMES: Record<string, string> = {
        directeur: 'Emmanuel Loukou',
        directrice_adjointe: 'Fatou',
        commerciale: 'Miss Kady',
        chef_technique: 'Koné Daouda',
        technicien_adjoint: 'Sidick',
        superviseur_logistique: 'Oumou',
      };
      const assigneeRole = (data as any).assignee || '';
      const humanName = ROLE_NAMES[assigneeRole] || assigneeRole || 'Gestionnaire';
      const taskTitle = data.title || '';
      const isPhaseValidation = !!(data as any).is_phase_validation;

      // Fetch la checklist liée à cette tâche
      supabase.from('checklists').select('*').eq('task_id', taskId).maybeSingle().then(async ({ data: cl }) => {
        if (!cl) return;
        const clId = cl.id;
        const clTitle = cl.title || '';
        const items: any[] = cl.items || [];
        const totalItems = items.length;
        if (totalItems === 0) return;
        const clProjectId = cl.project_id;

        // 📊 Résoudre project_name
        let projectName = '';
        try {
          const { data: proj } = await supabase.from('projects').select('name').eq('id', clProjectId).maybeSingle();
          projectName = (proj as any)?.name || '';
        } catch { /* valeurs par défaut */ }

        if (movedToEnCours) {
          // Cocher le 1er item non fait
          const firstUndone = items.findIndex((i: any) => !i.done);
          if (firstUndone === -1) return; // tout déjà fait
          const updatedItems = items.map((item: any, idx: number) =>
            idx === firstUndone ? { ...item, done: true, done_by: 'user', done_at: new Date().toISOString() } : item
          );
          const newDone = updatedItems.filter((i: any) => i.done).length;
          const newPct = Math.round((newDone / totalItems) * 100);

          supabase.from('checklists').update({
            items: updatedItems, total_items: totalItems, completed_items: newDone, percentage: newPct,
          }).eq('id', clId).then(() => {
            queryClient.invalidateQueries({ queryKey: ['checklists', projectId] });
          });

          // Notifier Communicateur : checklist_progress
          supabase.from('communicator_queue').insert({
            direction: 'pm_to_communicator', action: 'checklist_progress', status: 'pending', retry_count: 0,
            project_id: clProjectId,
            payload: { checklist_id: clId, checklist_url: `https://assoai.srv1720118.hstgr.cloud/public/checklist/${clId}?user=${encodeURIComponent(humanName)}&role=${encodeURIComponent(assigneeRole)}`, checklist_title: clTitle, task_id: taskId,
              task_title: taskTitle, project_id: clProjectId, project_name: projectName,
              human_name: humanName, pct: newPct, done: newDone, total: totalItems,
              newly_completed: 1, saved_at: new Date().toISOString() },
          }).then(() => {});
        }

        if (movedToTermine) {
          // Marquer TOUS les items comme faits
          const updatedItems = items.map((item: any) =>
            item.done ? item : { ...item, done: true, done_by: 'user', done_at: new Date().toISOString() }
          );
          const allDone = updatedItems.length;
          supabase.from('checklists').update({
            items: updatedItems, total_items: allDone, completed_items: allDone, percentage: 100,
          }).eq('id', clId).then(() => {
            queryClient.invalidateQueries({ queryKey: ['checklists', projectId] });
          });

          // Notifier PM + Communicateur : task_completed ×2
          supabase.from('communicator_queue').insert({
            direction: 'communicator_to_pm', action: 'task_completed', status: 'pending', retry_count: 0,
            project_id: clProjectId,
            payload: { checklist_id: clId, checklist_url: `https://assoai.srv1720118.hstgr.cloud/public/checklist/${clId}?user=${encodeURIComponent(humanName)}&role=${encodeURIComponent(assigneeRole)}`, checklist_title: clTitle, task_id: taskId,
              is_phase_validation: isPhaseValidation,
              task_title: taskTitle, project_id: clProjectId, project_name: projectName,
              pct: 100, done: allDone, total: allDone,
              newly_completed: allDone, completed_at: new Date().toISOString() },
          }).then(() => {});
          supabase.from('communicator_queue').insert({
            direction: 'pm_to_communicator', action: 'task_completed', status: 'pending', retry_count: 0,
            project_id: clProjectId,
            payload: { checklist_id: clId, checklist_url: `https://assoai.srv1720118.hstgr.cloud/public/checklist/${clId}?user=${encodeURIComponent(humanName)}&role=${encodeURIComponent(assigneeRole)}`, checklist_title: clTitle, task_id: taskId,
              is_phase_validation: isPhaseValidation,
              task_title: taskTitle, project_id: clProjectId, project_name: projectName,
              human_name: humanName, pct: 100, done: allDone, total: allDone,
              newly_completed: allDone, completed_at: new Date().toISOString() },
          }).then(() => {});
        }
      }).catch(() => {});
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  // Delete a task — supprime aussi la checklist liée
  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      // 1. Supprimer la checklist liée à cette tâche
      const { error: clErr } = await supabase
        .from('checklists')
        .delete()
        .eq('task_id', id);
      if (clErr) console.error('deleteTask: checklists error', clErr);

      // 2. Supprimer la tâche
      const { error } = await supabase
        .from('project_tasks')
        .delete()
        .eq('id', id);

      if (error) throw new Error(error.message);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['checklists', projectId] });
      toast({ title: 'Tâche et checklist supprimées' });
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
