import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Checklist, ChecklistFormData, ChecklistItemUpdate } from '@/types/checklist';
import { useToast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';

export const useChecklists = (projectId?: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch all checklists for a project
  const { data: checklists, isLoading, error } = useQuery({
    queryKey: ['checklists', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      
      const { data, error } = await supabase
        .from('checklists')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      if (error) throw new Error(error.message);
      return (data || []) as Checklist[];
    },
    enabled: !!projectId,
  });

  // Create checklist
  const createChecklist = useMutation({
    mutationFn: async (form: ChecklistFormData & { project_id: string }) => {
      const items = (form.items || []).map(item => ({
        ...item,
        id: item.id || uuidv4(),
        done: false,
      }));

      const total = items.length;
      const completed = items.filter(i => i.done).length;

      const { data, error } = await supabase
        .from('checklists')
        .insert({
          project_id: form.project_id,
          task_id: form.task_id,
          title: form.title,
          section: form.section,
          phase: form.phase,
          items,
          total_items: total,
          completed_items: completed,
          percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data as Checklist;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklists', projectId] });
      toast({ title: 'Checklist créée' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  // Toggle a checklist item (done/undone)
  const toggleItem = useMutation({
    mutationFn: async ({ checklistId, itemId, itemIndex, done, doneBy, imageUrl, galleryImages, notes, isCheck }: 
      { checklistId: string; itemIndex?: number; isCheck?: boolean } & ChecklistItemUpdate & { doneBy?: string; galleryImages?: string[] }) => {
      
      // Fetch current checklist
      const { data: current, error: fetchErr } = await supabase
        .from('checklists')
        .select('items')
        .eq('id', checklistId)
        .single();

      if (fetchErr) throw new Error(fetchErr.message);

      const items = (current.items || []) as Record<string, unknown>[];
      const updatedItems = items.map((item: Record<string, unknown>, idx: number) => {
        // Match par id si présent, sinon par index (items legacy sans id)
        const isTarget = (item.id && item.id === itemId) || 
                         (!item.id && idx === (itemIndex ?? -1));
        if (isTarget) {
          const existingGallery = (item.gallery_images as string[]) || [];
          // Fusionner les nouvelles images avec l'existante
          const mergedGallery = galleryImages
            ? [...new Set([...existingGallery, ...galleryImages])]
            : existingGallery;
          // Rétrocompatibilité : migrer image_url vers gallery_images
          if (item.image_url && typeof item.image_url === 'string' && !mergedGallery.includes(item.image_url as string)) {
            mergedGallery.unshift(item.image_url as string);
          }
          return {
            ...item,
            // Toujours ajouter un id au cas où l'item n'en avait pas
            id: item.id || itemId || `item-${idx}`,
            done: done !== undefined ? done : !item.done,
            done_by: doneBy || item.done_by,
            done_at: done ? new Date().toISOString() : null,
            image_url: imageUrl || item.image_url,
            gallery_images: mergedGallery,
            notes: notes !== undefined ? notes : item.notes,
          };
        }
        return item;
      });

      const total = updatedItems.length;
      const completed = updatedItems.filter((i: Record<string, unknown>) => i.done).length;
      const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

      const { data, error } = await supabase
        .from('checklists')
        .update({
          items: updatedItems,
          total_items: total,
          completed_items: completed,
          percentage,
        })
        .eq('id', checklistId)
        .select('*')
        .single();

      if (error) throw new Error(error.message);
      return { checklist: data as Checklist, percentage, task_id: (data as any).task_id };
    },
    onSuccess: async (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['checklists', projectId] });
      
      if (!result.task_id) return; // pas de tâche liée → rien à faire

      // ⛔ Anti-régression : ne notifier que les progressions réelles
      if (variables.isCheck === false) return;

      // 🔄 Le trigger DB bridge_checklist_to_kanban met à jour project_tasks.kanban_column
      //    de façon synchrone (AFTER UPDATE dans la même transaction). On rafraîchit juste l'UI.
      queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] });
      if (result.percentage > 0 && result.percentage < 100) {
        toast({ title: '🚀 Tâche démarrée', description: 'Premier item validé, la tâche passe en cours.' });
      } else if (result.percentage === 100) {
        toast({ title: '✅ Tâche terminée', description: 'Toutes les checklists sont complétées.' });
      }

      // 🔔 Synchronisation Communicateur : insérer dans la queue (mêmes payloads que ChecklistSlide)
      const cl = result.checklist as any;
      const clProjectId = cl?.project_id;
      const clTitle = cl?.title || '';
      const totalItems = cl?.total_items || cl?.items?.length || 0;
      const doneItems = cl?.completed_items || 0;
      if (!clProjectId || totalItems === 0) return;

      // Mapping rôles → noms humains (identique à ChecklistSlide.tsx)
      const ROLE_NAMES: Record<string, string> = {
        directeur: 'Emmanuel Loukou',
        directrice_adjointe: 'Fatou',
        commerciale: 'Miss Kady',
        chef_technique: 'Koné Daouda',
        technicien_adjoint: 'Sidick',
        superviseur_logistique: 'Oumou',
      };

      // 📊 Résoudre project_name, task_title, et assignee (human_name)
      let projectName = '';
      let taskTitle = clTitle;
      let humanName = 'Gestionnaire';
      let assigneeRole = '';

      try {
        const [projRes, taskRes] = await Promise.all([
          supabase.from('projects').select('name').eq('id', clProjectId).maybeSingle(),
          supabase.from('project_tasks').select('title, assignee, is_phase_validation').eq('id', result.task_id).maybeSingle(),
        ]);
        projectName = (projRes.data as any)?.name || '';
        taskTitle = (taskRes.data as any)?.title || clTitle;
        assigneeRole = (taskRes.data as any)?.assignee || '';
        const isPhaseValidation = !!(taskRes.data as any)?.is_phase_validation;
        humanName = ROLE_NAMES[assigneeRole] || assigneeRole || 'Gestionnaire';
      } catch { /* fire-and-forget : valeurs par défaut utilisées */ }

      if (result.percentage === 100) {
        // 100% → task_completed ×2 (PM + Communicateur)
        supabase.from('communicator_queue').insert({
          direction: 'communicator_to_pm', action: 'task_completed', status: 'pending', retry_count: 0,
          project_id: clProjectId,
          payload: { checklist_id: cl.id, checklist_url: `https://assoai.srv1720118.hstgr.cloud/public/checklist/${cl.id}?user=${encodeURIComponent(humanName)}&role=${encodeURIComponent(assigneeRole)}`, checklist_title: clTitle, task_id: result.task_id,
            is_phase_validation: isPhaseValidation,
            task_title: taskTitle, project_id: clProjectId, project_name: projectName,
            pct: 100, done: doneItems, total: totalItems,
            newly_completed: 1, completed_at: new Date().toISOString() },
        }).then(() => {});
        supabase.from('communicator_queue').insert({
          direction: 'pm_to_communicator', action: 'task_completed', status: 'pending', retry_count: 0,
          project_id: clProjectId,
          payload: { checklist_id: cl.id, checklist_url: `https://assoai.srv1720118.hstgr.cloud/public/checklist/${cl.id}?user=${encodeURIComponent(humanName)}&role=${encodeURIComponent(assigneeRole)}`, checklist_title: clTitle, task_id: result.task_id,
            is_phase_validation: isPhaseValidation,
            task_title: taskTitle, project_id: clProjectId, project_name: projectName,
            human_name: humanName, pct: 100, done: doneItems, total: totalItems,
            newly_completed: 1, completed_at: new Date().toISOString() },
        }).then(() => {});
      } else if (result.percentage > 0) {
        // 1-99% → checklist_progress
        supabase.from('communicator_queue').insert({
          direction: 'pm_to_communicator', action: 'checklist_progress', status: 'pending', retry_count: 0,
          project_id: clProjectId,
          payload: { checklist_id: cl.id, checklist_url: `https://assoai.srv1720118.hstgr.cloud/public/checklist/${cl.id}?user=${encodeURIComponent(humanName)}&role=${encodeURIComponent(assigneeRole)}`, checklist_title: clTitle, task_id: result.task_id,
            task_title: taskTitle, project_id: clProjectId, project_name: projectName,
            human_name: humanName, pct: result.percentage, done: doneItems, total: totalItems,
            newly_completed: 1, saved_at: new Date().toISOString() },
        }).then(() => {});
      }
    },
  });

  // Delete checklist
  const deleteChecklist = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('checklists')
        .delete()
        .eq('id', id);
      if (error) throw new Error(error.message);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklists', projectId] });
      toast({ title: 'Checklist supprimée' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  // Add item to a checklist
  const addItem = useMutation({
    mutationFn: async ({ checklistId, label }: { checklistId: string; label: string }) => {
      // Fetch current checklist
      const { data: current, error: fetchErr } = await supabase
        .from('checklists')
        .select('items')
        .eq('id', checklistId)
        .single();

      if (fetchErr) throw new Error(fetchErr.message);

      const items = (current.items || []) as Record<string, unknown>[];
      const newItem: Record<string, unknown> = {
        id: uuidv4(),
        label: label.trim(),
        done: false,
        done_by: null,
        done_at: null,
        required_image: false,
        image_url: null,
        gallery_images: [],
        notes: '',
      };
      items.push(newItem);

      const total = items.length;
      const completed = items.filter((i: Record<string, unknown>) => i.done).length;

      const { data, error } = await supabase
        .from('checklists')
        .update({
          items,
          total_items: total,
          completed_items: completed,
          percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
        })
        .eq('id', checklistId)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data as Checklist;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklists', projectId] });
    },
  });

  // Link/unlink checklist to a Kanban task
  const linkTask = useMutation({
    mutationFn: async ({ checklistId, taskId }: { checklistId: string; taskId: string | null }) => {
      const { data, error } = await supabase
        .from('checklists')
        .update({ task_id: taskId })
        .eq('id', checklistId)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data as Checklist;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklists', projectId] });
    },
  });

  return {
    checklists,
    isLoading,
    error,
    createChecklist,
    toggleItem,
    addItem,
    deleteChecklist,
    linkTask,
  };
};
