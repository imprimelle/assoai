import { useQueries } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

async function fetchTaskCount(projectId: string): Promise<{ projectId: string; count: number }> {
  const { count, error } = await supabase
    .from('project_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId);

  return { projectId, count: error ? 0 : (count || 0) };
}

/**
 * Hook batch : compte les tâches Kanban pour une liste de projets.
 * Utilisé pour détecter les projets "Brouillon" (non initialisés).
 */
export const useProjectsTaskCounts = (projectIds: string[], enabled = true) => {
  const queries = useQueries({
    queries: projectIds.map(pid => ({
      queryKey: ['project-task-count', pid],
      queryFn: () => fetchTaskCount(pid),
      staleTime: 30000,
      enabled: enabled && projectIds.length > 0,
    })),
  });

  const counts = new Map<string, number>();
  queries.forEach(q => {
    if (q.data) counts.set(q.data.projectId, q.data.count);
  });
  return counts;
};
