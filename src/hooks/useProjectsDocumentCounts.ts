import { useQueries } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Retourne les compteurs de documents pour une liste de projets.
 * Utilisé par la page Projects pour afficher les vrais compteurs.
 */
export const useProjectsDocumentCounts = (projectIds: string[]) => {
  const queries = useQueries({
    queries: projectIds.map(pid => ({
      queryKey: ['project-doc-count', pid],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('messages')
          .select('template_type')
          .eq('project_id', pid)
          .not('template_type', 'is', null)
          // 🔧 FIX: exclure les versions périmées (is_latest=false)
          .or('template_data->data->>is_latest.is.null,template_data->data->>is_latest.eq.true');

        if (error) return { projectId: pid, factures: 0, commandes: 0, devis: 0, cdCs: 0, total: 0 };

        const types = (data || []).map((d: any) => d.template_type);
        return {
          projectId: pid,
          factures: types.filter(t => t === 'facture').length,
          commandes: types.filter(t => t === 'commande').length,
          devis: types.filter(t => t === 'devis').length,
          cdCs: types.filter(t => t === 'cahier_des_charges').length,
          total: types.length,
        };
      },
      staleTime: 10000,
    })),
  });

  const counts = new Map<string, { factures: number; commandes: number; devis: number; cdCs: number; total: number }>();
  queries.forEach(q => {
    if (q.data) counts.set(q.data.projectId, q.data);
  });
  return counts;
};
