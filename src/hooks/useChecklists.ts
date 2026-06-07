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
    mutationFn: async ({ checklistId, itemId, done, doneBy, imageUrl, notes }: 
      { checklistId: string } & ChecklistItemUpdate & { doneBy?: string }) => {
      
      // Fetch current checklist
      const { data: current, error: fetchErr } = await supabase
        .from('checklists')
        .select('items')
        .eq('id', checklistId)
        .single();

      if (fetchErr) throw new Error(fetchErr.message);

      const items = (current.items || []) as Record<string, unknown>[];
      const updatedItems = items.map((item: Record<string, unknown>) => {
        if (item.id === itemId) {
          return {
            ...item,
            done: done !== undefined ? done : !item.done,
            done_by: doneBy || item.done_by,
            done_at: done ? new Date().toISOString() : null,
            image_url: imageUrl || item.image_url,
            notes: notes !== undefined ? notes : item.notes,
          };
        }
        return item;
      });

      const total = updatedItems.length;
      const completed = updatedItems.filter((i: Record<string, unknown>) => i.done).length;

      const { data, error } = await supabase
        .from('checklists')
        .update({
          items: updatedItems,
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

  return {
    checklists,
    isLoading,
    error,
    createChecklist,
    toggleItem,
    deleteChecklist,
  };
};
