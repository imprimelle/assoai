import { useQueries } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProjectHealthSnapshot {
  projectId: string;
  healthScore: number;
  totalTasks: number;
  completedTasks: number;
  totalChecklistItems: number;
  completedChecklistItems: number;
  totalDocuments: number;
}

const HEALTH_FORMULA = {
  DOCS_WEIGHT: 25,
  TASKS_WEIGHT: 25,
  CHECKLISTS_WEIGHT: 25,
  BLOCKAGE_WEIGHT: 25,
  MAX_DOCS: 3,
  MAX_BLOCKAGE_DAYS: 7,
};

async function fetchHealth(projectId: string): Promise<ProjectHealthSnapshot> {
  // 1. Documents
  const { data: docs } = await supabase
    .from('messages')
    .select('id, template_data')
    .eq('project_id', projectId)
    .not('template_type', 'is', null);

  const seenDocKeys = new Set<string>();
  (docs || []).forEach((d: any) => {
    const td = d.template_data?.data || {};
    const key = td.factureNumero || td.commandeNumero || td.cdcNumero || td.devisNumero;
    if (key) seenDocKeys.add(key);
  });
  const totalDocuments = seenDocKeys.size;

  // 2. Tasks
  const { data: tasks } = await supabase
    .from('project_tasks')
    .select('id, completed_at')
    .eq('project_id', projectId);

  const totalTasks = (tasks || []).length;
  const completedTasks = (tasks || []).filter((t: any) => t.completed_at).length;

  // 3. Checklists
  const { data: checklists } = await supabase
    .from('checklists')
    .select('total_items, completed_items')
    .eq('project_id', projectId);

  const totalChecklistItems = (checklists || []).reduce((sum: number, c: any) => sum + (c.total_items || 0), 0);
  const completedChecklistItems = (checklists || []).reduce((sum: number, c: any) => sum + (c.completed_items || 0), 0);

  // 4. Blockage (days since last activity)
  const { data: lastMsg } = await supabase
    .from('messages')
    .select('timestamp')
    .eq('project_id', projectId)
    .order('timestamp', { ascending: false })
    .limit(1);

  let daysSinceLastActivity = 0;
  if (lastMsg && lastMsg.length > 0) {
    const last = new Date(lastMsg[0].timestamp);
    const now = new Date();
    daysSinceLastActivity = Math.floor((now.getTime() - last.getTime()) / (1000 * 3600 * 24));
  }

  // Score
  const documentsScore = Math.min(totalDocuments / HEALTH_FORMULA.MAX_DOCS, 1) * HEALTH_FORMULA.DOCS_WEIGHT;
  const tasksScore = totalTasks > 0
    ? (completedTasks / totalTasks) * HEALTH_FORMULA.TASKS_WEIGHT
    : HEALTH_FORMULA.TASKS_WEIGHT;
  const checklistsScore = totalChecklistItems > 0
    ? (completedChecklistItems / totalChecklistItems) * HEALTH_FORMULA.CHECKLISTS_WEIGHT
    : HEALTH_FORMULA.CHECKLISTS_WEIGHT;
  const blockageScore = (1 - Math.min(daysSinceLastActivity / HEALTH_FORMULA.MAX_BLOCKAGE_DAYS, 1)) * HEALTH_FORMULA.BLOCKAGE_WEIGHT;
  const healthScore = Math.round(documentsScore + tasksScore + checklistsScore + blockageScore);

  return {
    projectId,
    healthScore,
    totalTasks,
    completedTasks,
    totalChecklistItems,
    completedChecklistItems,
    totalDocuments,
  };
}

/**
 * Hook batch : récupère les health scores pour une liste de projets.
 */
export const useProjectsHealth = (projectIds: string[], enabled = true) => {
  const queries = useQueries({
    queries: projectIds.map(pid => ({
      queryKey: ['project-health-batch', pid],
      queryFn: () => fetchHealth(pid),
      staleTime: 30000,
      enabled: enabled && projectIds.length > 0,
    })),
  });

  const snapshot = new Map<string, ProjectHealthSnapshot>();
  queries.forEach(q => {
    if (q.data) snapshot.set(q.data.projectId, q.data);
  });
  return snapshot;
};
