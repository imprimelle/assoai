import React, { useState, useMemo } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Project, normalizeProject } from '@/types/project';
import { User } from '@/types';
import { useProjectsTaskCounts } from '@/hooks/useProjectsTaskCounts';
import { useProjectsHealth } from '@/hooks/useProjectsHealth';
import { useProjectsDocumentCounts } from '@/hooks/useProjectsDocumentCounts';
import { PHASE_CONFIG } from '@/components/projects/phaseConfig';
import ProjectRecapDialog from './ProjectRecapDialog';
import { ChevronDown, ChevronUp, Layers, Clock, AlertTriangle } from 'lucide-react';

const KANBAN_PHASES = ['facturation', 'commande', 'fabrication', 'livraison'] as const;

const PHASE_LABELS: Record<string, string> = {
  facturation: 'Facturation',
  commande: 'Commande',
  fabrication: 'Fabrication',
  livraison: 'Livraison',
};

// ── Compteur visuel de pression ─────────────────────────────────────────

interface CountdownInfo {
  days: number;
  isOverdue: boolean;
  label: string;
  /** Niveau d'urgence : 0=calme, 1=approche, 2=urgent, 3=retard */
  urgency: 0 | 1 | 2 | 3;
}

function computeCountdown(dateStr: string): CountdownInfo {
  const target = new Date(dateStr);
  const now = new Date();
  // Réinitialiser les heures pour comparer uniquement les jours
  target.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  const diffMs = target.getTime() - now.getTime();
  const days = Math.ceil(diffMs / (1000 * 3600 * 24));

  if (days < 0) {
    const late = Math.abs(days);
    return { days: late, isOverdue: true, label: `+${late}j`, urgency: 3 };
  }
  if (days === 0) {
    return { days: 0, isOverdue: false, label: "Auj.", urgency: 2 };
  }
  if (days <= 3) {
    return { days, isOverdue: false, label: `J-${days}`, urgency: 2 };
  }
  if (days <= 7) {
    return { days, isOverdue: false, label: `J-${days}`, urgency: 1 };
  }
  if (days <= 14) {
    const weeks = Math.ceil(days / 7);
    return { days, isOverdue: false, label: `S-${weeks}`, urgency: 1 };
  }
  const weeks = Math.ceil(days / 7);
  return { days, isOverdue: false, label: `S-${weeks}`, urgency: 0 };
}

// ── Styles par niveau d'urgence ─────────────────────────────────────────

const URGENCY_STYLES: Record<number, {
  badgeBg: string; badgeText: string; badgeBorder: string;
  cardBorder: string; cardBg: string; pulse: string;
  icon: string;
}> = {
  0: { // Calme — vert
    badgeBg: 'bg-emerald-50', badgeText: 'text-emerald-700', badgeBorder: 'border-emerald-200',
    cardBorder: 'border-gray-200', cardBg: 'bg-white', pulse: '',
    icon: 'text-emerald-400',
  },
  1: { // Approche — ambre
    badgeBg: 'bg-amber-50', badgeText: 'text-amber-700', badgeBorder: 'border-amber-200',
    cardBorder: 'border-amber-100', cardBg: 'bg-white', pulse: '',
    icon: 'text-amber-400',
  },
  2: { // Urgent — orange/rouge
    badgeBg: 'bg-orange-50', badgeText: 'text-orange-700', badgeBorder: 'border-orange-200',
    cardBorder: 'border-orange-200', cardBg: 'bg-orange-50/30', pulse: 'animate-pulse',
    icon: 'text-orange-500',
  },
  3: { // Retard — rouge
    badgeBg: 'bg-red-100', badgeText: 'text-red-700', badgeBorder: 'border-red-300',
    cardBorder: 'border-red-300', cardBg: 'bg-red-50/60', pulse: 'animate-pulse',
    icon: 'text-red-500',
  },
};

// ── Composant ──────────────────────────────────────────────────────────

interface HomeMiniKanbanProps {
  user: User | null;
}

const HomeMiniKanban: React.FC<HomeMiniKanbanProps> = ({ user }) => {
  const [expanded, setExpanded] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // ── Tous les projets (sans filtre created_by) ────────────────────────

  const { data: allProjects, isLoading } = useQuery({
    queryKey: ['home-kanban-projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return (data || []).map((raw: Record<string, any>) => normalizeProject(raw));
    },
    staleTime: 10_000,
  });

  // ── Projets avec phase active ────────────────────────────────────────

  const phaseFiltered = useMemo(() => {
    if (!allProjects) return [];
    return allProjects.filter(
      (p) => p.phase && (KANBAN_PHASES as readonly string[]).includes(p.phase)
    );
  }, [allProjects]);

  const projectIds = useMemo(() => phaseFiltered.map((p) => p.id), [phaseFiltered]);

  // ── Batch hooks ──────────────────────────────────────────────────────

  const taskCountMap = useProjectsTaskCounts(projectIds, projectIds.length > 0);
  const healthMap = useProjectsHealth(projectIds, projectIds.length > 0);
  const docCountMap = useProjectsDocumentCounts(projectIds);

  // ── Dates de livraison depuis les commandes (batch) ──────────────────

  const deliveryQueries = useQueries({
    queries: projectIds.map((pid) => ({
      queryKey: ['home-kanban-delivery', pid],
      queryFn: async () => {
        const { data } = await supabase
          .from('messages')
          .select('template_data')
          .eq('project_id', pid)
          .eq('template_type', 'commande')
          .or('template_data->data->>is_latest.is.null,template_data->data->>is_latest.eq.true')
          .order('timestamp', { ascending: false })
          .limit(1);

        const cmd = data?.[0];
        const dateStr = cmd?.template_data?.data?.dateLivraison || null;
        return { projectId: pid, dateStr };
      },
      staleTime: 30_000,
      enabled: projectIds.length > 0,
    })),
  });

  const deliveryMap = useMemo(() => {
    const map = new Map<string, string | null>();
    deliveryQueries.forEach((q) => {
      if (q.data) map.set(q.data.projectId, q.data.dateStr);
    });
    return map;
  }, [deliveryQueries]);

  // ── Exclure les brouillons (0 tâche) ────────────────────────────────

  const activeProjects = useMemo(() => {
    return phaseFiltered.filter((p) => {
      const taskCount = taskCountMap.get(p.id);
      if (taskCount === undefined) return true; // pas encore chargé
      return taskCount > 0;
    });
  }, [phaseFiltered, taskCountMap]);

  // ── Grouper par phase ────────────────────────────────────────────────

  const columns = useMemo(() => {
    const grouped: Record<string, Project[]> = {};
    for (const phase of KANBAN_PHASES) {
      grouped[phase] = activeProjects.filter((p) => p.phase === phase);
    }
    return grouped;
  }, [activeProjects]);

  const totalProjects = activeProjects.length;

  if (isLoading) return null;

  return (
    <>
      {/* Bouton expand/collapse */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 mt-2 mb-1 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-brand-orange" />
          <span className="text-sm font-semibold text-gray-700">
            Mes projets en cours
          </span>
          <span className="text-xs bg-brand-orange/10 text-brand-orange font-bold px-2 py-0.5 rounded-full">
            {totalProjects}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        )}
      </button>

      {/* Kanban déplié */}
      {expanded && (
        <div className="mb-6 overflow-x-auto -mx-4 px-4 scrollbar-thin">
          {totalProjects === 0 ? (
            <div className="text-center py-4">
              <p className="text-xs text-gray-400">
                Aucun projet en cours pour le moment.
              </p>
            </div>
          ) : (
          <div className="flex gap-3 min-w-max">
            {KANBAN_PHASES.map((phase) => {
              const phaseProjects = columns[phase] || [];
              const cfg = PHASE_CONFIG[phase];
              const label = PHASE_LABELS[phase] || phase;

              return (
                <div
                  key={phase}
                  className="flex-shrink-0 w-[210px] sm:w-[230px]"
                >
                  {/* En-tête colonne */}
                  <div className="flex items-center gap-1.5 mb-2 px-1">
                    <div
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: cfg?.hex || '#999' }}
                    />
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {label}
                    </span>
                    <span className="text-[10px] text-gray-400 ml-auto">
                      {phaseProjects.length}
                    </span>
                  </div>

                  {/* Cartes */}
                  <div className="space-y-2">
                    {phaseProjects.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-gray-200 px-3 py-4 text-center">
                        <p className="text-[11px] text-gray-400">Aucun projet</p>
                      </div>
                    ) : (
                      phaseProjects.map((project) => {
                        const health = healthMap.get(project.id);
                        const docCount = docCountMap.get(project.id);
                        const score = health?.healthScore ?? 0;
                        const deliveryDate = deliveryMap.get(project.id);

                        // Calcul du compteur
                        const cdn = deliveryDate ? computeCountdown(deliveryDate) : null;
                        const urgency = cdn?.urgency ?? 0;
                        const styles = URGENCY_STYLES[urgency];

                        // Date formatée
                        const formattedDate = deliveryDate
                          ? new Date(deliveryDate).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'short',
                              year: '2-digit',
                            })
                          : null;

                        return (
                          <button
                            key={project.id}
                            onClick={() => setSelectedProject(project)}
                            className={`w-full text-left rounded-xl border-2 ${styles.cardBorder} ${styles.cardBg} p-3 hover:shadow-md transition-all duration-200 active:scale-[0.98] relative overflow-hidden`}
                          >
                            {/* ═══ Barre latérale de pression (gauche) ═══ */}
                            {cdn && (
                              <div
                                className={`absolute left-0 top-0 bottom-0 w-1 ${
                                  urgency === 3
                                    ? 'bg-red-500'
                                    : urgency === 2
                                      ? 'bg-orange-400'
                                      : urgency === 1
                                        ? 'bg-amber-400'
                                        : 'bg-emerald-400'
                                }`}
                              />
                            )}

                            {/* ── Ligne 1 : Nom + Compteur ── */}
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                              <span className="text-xs font-bold text-gray-800 leading-tight truncate flex-1">
                                {project.name}
                              </span>

                              {/* Badge compteur de pression */}
                              {cdn && (
                                <div
                                  className={`shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${styles.badgeBg} ${styles.badgeText} ${styles.badgeBorder} ${styles.pulse}`}
                                >
                                  {urgency === 3 ? (
                                    <AlertTriangle className="h-3 w-3" />
                                  ) : (
                                    <Clock className={`h-3 w-3 ${styles.icon}`} />
                                  )}
                                  <span>{cdn.label}</span>
                                </div>
                              )}
                            </div>

                            {/* ── Ligne 2 : Badge phase ── */}
                            <span
                              className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full mb-2"
                              style={{
                                backgroundColor: cfg?.bg || '#f3f4f6',
                                color: cfg?.color || '#374151',
                              }}
                            >
                              {cfg?.label || label}
                            </span>

                            {/* ── Barre de santé ── */}
                            <div className="h-1 bg-gray-200/70 rounded-full overflow-hidden mb-1.5">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${score}%`,
                                  backgroundColor:
                                    score >= 80
                                      ? '#22c55e'
                                      : score >= 50
                                        ? '#f59e0b'
                                        : '#ef4444',
                                }}
                              />
                            </div>

                            {/* ── Ligne 3 : Stats + Date de livraison ── */}
                            <div className="flex items-center gap-2 text-[10px]">
                              <span className="text-gray-500 font-medium">
                                {score}%
                              </span>
                              {docCount && docCount.total > 0 && (
                                <span className="text-gray-400">
                                  · {docCount.total} doc{docCount.total > 1 ? 's' : ''}
                                </span>
                              )}
                              {formattedDate && (
                                <span
                                  className={`ml-auto font-semibold ${
                                    urgency === 3
                                      ? 'text-red-600'
                                      : urgency === 2
                                        ? 'text-orange-600'
                                        : 'text-gray-500'
                                  }`}
                                >
                                  {formattedDate}
                                </span>
                              )}
                            </div>

                            {/* ── Bandeau RETARD ── */}
                            {cdn?.isOverdue && (
                              <div className="mt-2 -mx-3 -mb-3 px-3 py-1 bg-red-100/80 border-t border-red-200 rounded-b-xl">
                                <p className="text-[10px] font-bold text-red-700 text-center uppercase tracking-widest">
                                  ⚠ Retard
                                </p>
                              </div>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
            )}
        </div>
      )}

      {/* Dialogue récapitulatif */}
      {selectedProject && (
        <ProjectRecapDialog
          project={selectedProject}
          userRole={user?.role || ''}
          open={!!selectedProject}
          onClose={() => setSelectedProject(null)}
        />
      )}
    </>
  );
};

export default HomeMiniKanban;
