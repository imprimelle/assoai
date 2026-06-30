import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface GenerationRules {
  mode: 'statique' | 'projection_cdc' | 'par_enseigne';
  // Mode statique
  fixed_items?: string[];
  // Mode projection_cdc
  source?: {
    sections: string[];
    action_mapping?: Record<string, string>;
    exclude?: { section: string; nom_contains: string }[];
    exceptions?: { section: string; nom_contains: string; override_action: string }[];
  };
  item_template?: string;
  // Mode par_enseigne
  title_template?: string;
  // Commun
  note?: string;
  // Contexte documentaire (statique et par_enseigne uniquement)
  contexte?: {
    documents: ('cdc' | 'facture' | 'commande' | 'devis')[];
  };
}

export interface Procedure {
  id: string;
  phase: string;
  order: number;
  task_title: string;
  task_assignee: string;
  task_priority: string;
  task_due_days: number;
  checklist_title: string | null;
  checklist_items: { text: string }[];
  instructions: string | null;
  generation_rules: GenerationRules | null;
  depends_on_order: number | null;
  depends_on_procedure_id: string | null;
  is_phase_validation: boolean;
  required_image: boolean;
  depends_description: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProcedureFormData {
  phase: string;
  order?: number;
  task_title: string;
  task_assignee: string;
  task_priority?: string;
  task_due_days?: number;
  checklist_title?: string;
  checklist_items?: { text: string }[];
  instructions?: string | null;
  generation_rules?: GenerationRules | null;
  depends_on_order?: number | null;
  depends_on_procedure_id?: string | null;
  is_phase_validation?: boolean;
  required_image?: boolean;
  depends_description?: string | null;
}

export const useProcedures = (phase?: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: procedures, isLoading, error } = useQuery({
    queryKey: ['procedures', phase],
    queryFn: async () => {
      let query = supabase.from('procedures').select('*').order('order', { ascending: true });
      if (phase) query = query.eq('phase', phase);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data || []) as Procedure[];
    },
  });

  const createProcedure = useMutation({
    mutationFn: async (form: ProcedureFormData) => {
      const { data, error } = await supabase
        .from('procedures')
        .insert({
          phase: form.phase,
          order: form.order || 0,
          task_title: form.task_title,
          task_assignee: form.task_assignee,
          task_priority: form.task_priority || 'medium',
          task_due_days: form.task_due_days || 3,
          checklist_title: form.checklist_title || null,
          checklist_items: form.checklist_items || [],
          instructions: form.instructions || null,
          generation_rules: form.generation_rules || null,
          depends_on_order: form.depends_on_order || null,
          depends_on_procedure_id: form.depends_on_procedure_id || null,
          is_phase_validation: form.is_phase_validation || false,
          required_image: form.required_image || false,
          depends_description: form.depends_description || null,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as Procedure;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procedures'] });
      toast({ title: 'Procédure créée' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  const updateProcedure = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Procedure> & { id: string }) => {
      const { data, error } = await supabase
        .from('procedures')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as Procedure;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procedures'] });
      toast({ title: 'Procédure mise à jour' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  const deleteProcedure = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('procedures').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procedures'] });
      toast({ title: 'Procédure supprimée' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  return { procedures, isLoading, error, createProcedure, updateProcedure, deleteProcedure };
};
