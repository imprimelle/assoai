import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ProjectHealthData {
  healthScore: number;
  documentsScore: number;
  tasksScore: number;
  checklistsScore: number;
  blockageScore: number;
  details: {
    totalDocuments: number;
    totalTasks: number;
    completedTasks: number;
    totalChecklistItems: number;
    completedChecklistItems: number;
    daysSinceLastActivity: number;
  };
  status: 'excellent' | 'bon' | 'moyen' | 'faible' | 'critique';
}

const HEALTH_FORMULA = {
  DOCS_WEIGHT: 25,
  TASKS_WEIGHT: 25,
  CHECKLISTS_WEIGHT: 25,
  BLOCKAGE_WEIGHT: 25,
  MAX_DOCS: 3,
  MAX_BLOCKAGE_DAYS: 7,
};

function computeScore(data: {
  totalDocuments: number;
  totalTasks: number;
  completedTasks: number;
  totalChecklistItems: number;
  completedChecklistItems: number;
  daysSinceLastActivity: number;
}): ProjectHealthData {
  const documentsScore = Math.min(data.totalDocuments / HEALTH_FORMULA.MAX_DOCS, 1) * HEALTH_FORMULA.DOCS_WEIGHT;
  const tasksScore = data.totalTasks > 0
    ? (data.completedTasks / data.totalTasks) * HEALTH_FORMULA.TASKS_WEIGHT
    : HEALTH_FORMULA.TASKS_WEIGHT;
  const checklistsScore = data.totalChecklistItems > 0
    ? (data.completedChecklistItems / data.totalChecklistItems) * HEALTH_FORMULA.CHECKLISTS_WEIGHT
    : HEALTH_FORMULA.CHECKLISTS_WEIGHT;
  const blockageScore = (1 - Math.min(data.daysSinceLastActivity / HEALTH_FORMULA.MAX_BLOCKAGE_DAYS, 1)) * HEALTH_FORMULA.BLOCKAGE_WEIGHT;

  const healthScore = Math.round(documentsScore + tasksScore + checklistsScore + blockageScore);

  let status: ProjectHealthData['status'] = 'critique';
  if (healthScore >= 80) status = 'excellent';
  else if (healthScore >= 60) status = 'bon';
  else if (healthScore >= 40) status = 'moyen';
  else if (healthScore >= 20) status = 'faible';

  return {
    healthScore,
    documentsScore: Math.round(documentsScore),
    tasksScore: Math.round(tasksScore),
    checklistsScore: Math.round(checklistsScore),
    blockageScore: Math.round(blockageScore),
    details: data,
    status,
  };
}

export function useProjectHealth(projectId?: string) {
  return useQuery({
    queryKey: ['project-health', projectId],
    queryFn: async (): Promise<ProjectHealthData | null> => {
      if (!projectId) return null;

      // 1. Compter les documents (dédoublonnés par identifiant)
      const { data: docs, error: docsErr } = await supabase
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

      // 2. Compter les tâches
      const { data: tasks, error: tasksErr } = await supabase
        .from('project_tasks')
        .select('id, completed_at')
        .eq('project_id', projectId);

      const totalTasks = (tasks || []).length;
      const completedTasks = (tasks || []).filter((t: any) => t.completed_at).length;

      // 3. Compter les items de checklists
      const { data: checklists, error: clErr } = await supabase
        .from('checklists')
        .select('total_items, completed_items')
        .eq('project_id', projectId);

      const totalChecklistItems = (checklists || []).reduce((sum: number, c: any) => sum + (c.total_items || 0), 0);
      const completedChecklistItems = (checklists || []).reduce((sum: number, c: any) => sum + (c.completed_items || 0), 0);

      // 4. Jours depuis dernière activité
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

      return computeScore({
        totalDocuments,
        totalTasks,
        completedTasks,
        totalChecklistItems,
        completedChecklistItems,
        daysSinceLastActivity,
      });
    },
    enabled: !!projectId,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: 5000, // Rafraîchit le mini dashboard toutes les 5s
  });
}
