import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Project } from '@/types/project';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Clock, FileText, AlertTriangle, CheckCircle2, CircleDot } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { PHASE_CONFIG } from './phaseConfig';
import { ProjectHealthSnapshot } from '@/hooks/useProjectsHealth';
import { cn } from '@/lib/utils';

interface ProjectKanbanViewProps {
  projects: Project[];
  healthScores: Map<string, ProjectHealthSnapshot>;
  taskCounts: Map<string, number>;
  docCounts: Map<string, { total: number }>;
}

const KANBAN_COLUMNS = [
  { key: 'brouillon', title: 'Brouillon' },
  { key: 'facturation', title: 'Facturation' },
  { key: 'commande', title: 'Commande' },
  { key: 'fabrication', title: 'Fabrication' },
  { key: 'livraison', title: 'Livraison' },
  { key: 'termine', title: 'Terminé' },
];

function getKanbanPhase(project: Project, taskCounts: Map<string, number>): string {
  if (project.phase === 'termine') return 'termine';
  if (project.phase === 'facturation') {
    const taskCount = taskCounts.get(project.id) ?? 0;
    if (taskCount === 0) return 'brouillon';
  }
  return project.phase || 'facturation';
}

function isLate(project: Project): boolean {
  if (!project.date_livraison || project.phase === 'termine') return false;
  return new Date(project.date_livraison) < new Date();
}

const ProjectKanbanCard: React.FC<{
  project: Project;
  health: ProjectHealthSnapshot | undefined;
  docCount: number;
  kanbanPhase: string;
}> = ({ project, health, docCount, kanbanPhase }) => {
  const navigate = useNavigate();
  const cfg = PHASE_CONFIG[kanbanPhase] || PHASE_CONFIG['facturation'];
  const score = health?.healthScore ?? 0;
  const late = isLate(project);

  const scoreColor =
    score >= 80 ? 'bg-gradient-to-r from-green-400 to-emerald-500' :
    score >= 50 ? 'bg-gradient-to-r from-amber-400 to-orange-400' :
    'bg-gradient-to-r from-red-400 to-rose-500';

  const scoreBg =
    score >= 80 ? 'bg-green-50 text-green-700' :
    score >= 50 ? 'bg-amber-50 text-amber-700' :
    'bg-red-50 text-red-700';

  return (
    <div
      className={cn(
        'group bg-white rounded-xl border shadow-sm p-3.5 cursor-pointer',
        'hover:shadow-lg hover:border-brand-orange/40 hover:-translate-y-0.5',
        'transition-all duration-200 ease-out',
        late && 'ring-1 ring-red-200'
      )}
      onClick={() => navigate(`/projects/${project.id}`)}
    >
      {/* Nom + badge phase */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="font-semibold text-sm leading-tight line-clamp-2">
          {project.name}
        </h4>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm"
              style={{ backgroundColor: `${cfg.hex}18` }}
            >
              {cfg.icon}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {cfg.label}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Badge phase texte */}
      <Badge
        variant="outline"
        className={cn('text-[10px] border-0 mb-2.5', cfg.color, cfg.bg)}
      >
        {cfg.icon} {cfg.label}
      </Badge>

      {/* Barre de progression */}
      <div className="mb-2.5">
        <div className="flex items-center justify-between text-[10px] mb-1">
          <span className="text-muted-foreground font-medium">Progression</span>
          <span className={cn('font-bold tabular-nums', scoreBg, 'px-1.5 py-0.5 rounded-full text-[9px]')}>
            {score}%
          </span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden shadow-inner">
          <div
            className={cn('h-full rounded-full transition-all duration-500 ease-out', scoreColor)}
            style={{ width: `${Math.max(score, 4)}%` }}
          />
        </div>
      </div>

      {/* Détails tâches (si dispo) */}
      {health && (health.totalTasks > 0 || health.totalChecklistItems > 0) && (
        <div className="flex items-center gap-2 mb-2 text-[10px] text-muted-foreground">
          {health.totalTasks > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-1">
                  <CircleDot className="h-3 w-3" />
                  {health.completedTasks}/{health.totalTasks}
                </span>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">Tâches Kanban</TooltipContent>
            </Tooltip>
          )}
          {health.totalChecklistItems > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {health.completedChecklistItems}/{health.totalChecklistItems}
                </span>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">Items checklist</TooltipContent>
            </Tooltip>
          )}
        </div>
      )}

      {/* Pied : docs + date */}
      <div className="flex items-center justify-between text-[10px] pt-1.5 border-t border-gray-50">
        <span className="flex items-center gap-1 text-muted-foreground">
          <FileText className="h-3 w-3" />
          {docCount} doc{docCount !== 1 ? 's' : ''}
        </span>
        {project.date_livraison && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  'flex items-center gap-1 font-medium',
                  late ? 'text-red-600 bg-red-50 px-1.5 py-0.5 rounded' : 'text-muted-foreground'
                )}
              >
                {late ? <AlertTriangle className="h-3 w-3 animate-pulse" /> : <Clock className="h-3 w-3" />}
                {format(new Date(project.date_livraison), 'dd MMM', { locale: fr })}
              </span>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">
              {late ? '⚠️ Livraison dépassée' : 'Date de livraison'}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
};

export const ProjectKanbanView: React.FC<ProjectKanbanViewProps> = ({
  projects,
  healthScores,
  taskCounts,
  docCounts,
}) => {
  // Grouper les projets par colonne Kanban
  const grouped = new Map<string, Project[]>();
  KANBAN_COLUMNS.forEach(col => grouped.set(col.key, []));

  projects.forEach(project => {
    const kanbanPhase = getKanbanPhase(project, taskCounts);
    const col = grouped.get(kanbanPhase);
    if (col) col.push(project);
  });

  const totalProjects = Array.from(grouped.values()).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <div className="overflow-x-auto pb-4 -mx-2 px-2 snap-x snap-mandatory scroll-smooth">
      <div className="flex gap-3 min-w-[1100px]">
        {KANBAN_COLUMNS.map(col => {
          const cfg = PHASE_CONFIG[col.key] || PHASE_CONFIG['facturation'];
          const items = grouped.get(col.key) || [];

          return (
            <div key={col.key} className="flex-1 min-w-[180px] max-w-[280px] snap-start">
              {/* En-tête colonne sticky */}
              <div
                className={cn(
                  'sticky top-0 z-10 rounded-xl px-3 py-2.5 mb-3 border shadow-sm backdrop-blur-sm',
                  cfg.bg.replace('bg-', 'bg-') + '/80'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: cfg.hex }}
                    />
                    <span className={cn('text-sm font-semibold', cfg.color)}>
                      {col.title}
                    </span>
                  </div>
                  <Badge
                    variant="secondary"
                    className={cn(
                      'text-[10px] h-5 px-1.5 min-w-[20px] justify-center',
                      items.length === 0 && 'opacity-40'
                    )}
                  >
                    {items.length}
                  </Badge>
                </div>
              </div>

              {/* Cartes */}
              <div className="space-y-2.5 max-h-[calc(100vh-320px)] overflow-y-auto pr-0.5 scrollbar-thin">
                {items.map(project => (
                  <ProjectKanbanCard
                    key={project.id}
                    project={project}
                    health={healthScores.get(project.id)}
                    docCount={docCounts.get(project.id)?.total ?? 0}
                    kanbanPhase={col.key}
                  />
                ))}
                {items.length === 0 && (
                  <div className="text-center py-8 border-2 border-dashed border-gray-100 rounded-xl">
                    <p className="text-xs text-muted-foreground/50 italic">
                      Aucun projet
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Indicateur de scroll horizontal (mobile) */}
      <div className="flex items-center justify-center gap-1 mt-4 sm:hidden">
        {KANBAN_COLUMNS.map((col) => {
          const items = grouped.get(col.key) || [];
          const cfg = PHASE_CONFIG[col.key] || PHASE_CONFIG['facturation'];
          return (
            <div
              key={col.key}
              className="w-1.5 h-1.5 rounded-full transition-all"
              style={{
                backgroundColor: cfg.hex,
                opacity: items.length > 0 ? 0.6 : 0.2,
                transform: items.length > 0 ? 'scale(1.2)' : 'scale(1)',
              }}
            />
          );
        })}
        <span className="text-[10px] text-muted-foreground ml-1.5">
          {totalProjects} projet{totalProjects !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
};
