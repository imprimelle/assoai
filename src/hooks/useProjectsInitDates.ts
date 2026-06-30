import { useQueries } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Récupère la date de la première tâche créée (date d'initialisation du projet).
 */
async function fetchInitDate(projectId: string): Promise<{ projectId: string; initDate: string | null }> {
  const { data } = await supabase
    .from('project_tasks')
    .select('created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
    .limit(1);

  return {
    projectId,
    initDate: data?.[0]?.created_at || null,
  };
}

export const useProjectsInitDates = (projectIds: string[], enabled = true) => {
  const queries = useQueries({
    queries: projectIds.map(pid => ({
      queryKey: ['project-init-date', pid],
      queryFn: () => fetchInitDate(pid),
      staleTime: 60000,
      enabled: enabled && projectIds.length > 0,
    })),
  });

  const dates = new Map<string, Date | null>();
  queries.forEach(q => {
    if (q.data) {
      dates.set(q.data.projectId, q.data.initDate ? new Date(q.data.initDate) : null);
    }
  });
  return dates;
};
