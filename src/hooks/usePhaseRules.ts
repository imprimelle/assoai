import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface PhaseRule {
  phase: string;
  checklist_rules: string | null;
  updated_at: string;
}

export const usePhaseRules = (phase?: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: rules, isLoading } = useQuery({
    queryKey: ['phase_rules', phase],
    queryFn: async () => {
      let query = supabase.from('phase_rules').select('*');
      if (phase) query = query.eq('phase', phase);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data || []) as PhaseRule[];
    },
  });

  const updateRule = useMutation({
    mutationFn: async ({ phase, checklist_rules }: { phase: string; checklist_rules: string }) => {
      const { data, error } = await supabase
        .from('phase_rules')
        .upsert({ phase, checklist_rules, updated_at: new Date().toISOString() })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as PhaseRule;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phase_rules'] });
      toast({ title: 'Règles sauvegardées ✅' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  return { rules, isLoading, updateRule };
};
