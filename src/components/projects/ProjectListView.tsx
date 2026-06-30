import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Project } from '@/types/project';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import {
  FolderOpen, FileText, ShoppingCart,
  ClipboardList, FileCheck, Clock, ArrowRight, Trash2,
  AlertTriangle, ChevronDown,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { PHASE_CONFIG } from './phaseConfig';
import { cn } from '@/lib/utils';

interface ProjectListViewProps {
  projects: Project[];
  docCounts: Map<string, { factures: number; commandes: number; devis: number; cdCs: number; total: number }>;
  taskCounts: Map<string, number>;
  expandedProject: string | null;
  onExpand: (id: string | null) => void;
  onDelete: (project: Project) => void;
}

export const ProjectListView: React.FC<ProjectListViewProps> = ({
  projects,
  docCounts,
  taskCounts,
  expandedProject,
  onExpand,
  onDelete,
}) => {
  const navigate = useNavigate();

  const getPhaseConfig = (phase?: string) => {
    return PHASE_CONFIG[phase || 'facturation'] || PHASE_CONFIG['facturation'];
  };

  const isLate = (project: Project): boolean => {
    if (!project.date_livraison || project.phase === 'termine') return false;
    return new Date(project.date_livraison) < new Date();
  };

  return (
    <Accordion
      type="single"
      collapsible
      value={expandedProject || undefined}
      onValueChange={(val) => onExpand(val || null)}
      className="space-y-3"
    >
      {projects.map(project => {
        const phaseCfg = getPhaseConfig(project.phase);
        const counts = docCounts.get(project.id) || { factures: 0, commandes: 0, devis: 0, cdCs: 0, total: 0 };
        const taskCount = taskCounts.get(project.id) || 0;
        const late = isLate(project);

        return (
          <AccordionItem
            key={project.id}
            value={project.id}
            className={cn(
              'border rounded-xl overflow-hidden bg-white shadow-sm',
              'hover:shadow-md transition-all duration-200',
              'group',
              late && 'ring-1 ring-red-200'
            )}
          >
            {/* En-tête de la carte */}
            <div className="flex items-center px-4 py-3.5">
              {/* Indicateur de phase (barre colorée à gauche) */}
              <div
                className="shrink-0 w-1 self-stretch rounded-full mr-3"
                style={{ backgroundColor: phaseCfg.hex, minHeight: '32px' }}
              />

              <AccordionTrigger className="flex-1 hover:no-underline py-0">
                <div className="flex items-center gap-3 text-left flex-1 min-w-0">
                  <span className="text-lg shrink-0">{phaseCfg.icon}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm md:text-base truncate max-w-[180px] sm:max-w-[280px]">
                        {project.name}
                      </h3>
                      {late && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0 animate-pulse" />
                          </TooltipTrigger>
                          <TooltipContent className="text-[10px]">
                            Livraison dépassée
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <Badge
                        variant="outline"
                        className={cn('text-[10px] border-0', phaseCfg.color, phaseCfg.bg)}
                      >
                        {phaseCfg.label}
                      </Badge>
                      {project.date_livraison && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className={cn(
                              'text-[10px] flex items-center gap-1',
                              late ? 'text-red-600 font-semibold' : 'text-muted-foreground'
                            )}>
                              <Clock className="h-3 w-3" />
                              {format(new Date(project.date_livraison), 'dd MMM yyyy', { locale: fr })}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="text-[10px]">
                            Date de livraison
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                </div>
              </AccordionTrigger>

              {/* Actions rapides */}
              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                {taskCount > 0 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="secondary" className="text-[10px] h-5 cursor-default bg-orange-50 text-orange-700 border-orange-200">
                        {taskCount} tâche{taskCount > 1 ? 's' : ''}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent className="text-[10px]">Tâches Kanban</TooltipContent>
                  </Tooltip>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary" className="text-[10px] h-5 cursor-default">
                      {counts.total} doc{counts.total !== 1 ? 's' : ''}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="text-[10px]">
                    {counts.factures > 0 && `${counts.factures} facture${counts.factures > 1 ? 's' : ''}`}
                    {counts.commandes > 0 && `, ${counts.commandes} commande${counts.commandes > 1 ? 's' : ''}`}
                    {counts.cdCs > 0 && `, ${counts.cdCs} CDC`}
                    {counts.devis > 0 && `, ${counts.devis} devis`}
                  </TooltipContent>
                </Tooltip>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/projects/${project.id}`);
                  }}
                  title="Ouvrir le projet"
                >
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-red-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(project);
                  }}
                  title="Supprimer le projet"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {/* Indicateur d'expansion */}
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform duration-200 group-data-[state=open]:rotate-180 ml-2" />
            </div>

            {/* Contenu dépliable */}
            <AccordionContent>
              <div className="px-4 pb-4 pt-0">
                {/* Description */}
                {project.description && (
                  <div className="bg-gray-50/70 rounded-lg p-3 mb-3">
                    <p className="text-sm text-muted-foreground">{project.description}</p>
                  </div>
                )}

                {/* Répartition documents */}
                {counts.total > 0 && (
                  <div className="space-y-1.5 mb-3">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                      Documents
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {counts.factures > 0 && (
                        <div className="flex items-center gap-2 text-xs p-2 rounded-lg bg-blue-50/60 border border-blue-100/50">
                          <FileText className="h-3.5 w-3.5 text-blue-600" />
                          <span className="text-muted-foreground">Factures</span>
                          <Badge variant="outline" className="ml-auto text-[10px] h-4 px-1.5 bg-white">{counts.factures}</Badge>
                        </div>
                      )}
                      {counts.commandes > 0 && (
                        <div className="flex items-center gap-2 text-xs p-2 rounded-lg bg-orange-50/60 border border-orange-100/50">
                          <ShoppingCart className="h-3.5 w-3.5 text-orange-600" />
                          <span className="text-muted-foreground">Commandes</span>
                          <Badge variant="outline" className="ml-auto text-[10px] h-4 px-1.5 bg-white">{counts.commandes}</Badge>
                        </div>
                      )}
                      {counts.cdCs > 0 && (
                        <div className="flex items-center gap-2 text-xs p-2 rounded-lg bg-purple-50/60 border border-purple-100/50">
                          <ClipboardList className="h-3.5 w-3.5 text-purple-600" />
                          <span className="text-muted-foreground">CDC</span>
                          <Badge variant="outline" className="ml-auto text-[10px] h-4 px-1.5 bg-white">{counts.cdCs}</Badge>
                        </div>
                      )}
                      {counts.devis > 0 && (
                        <div className="flex items-center gap-2 text-xs p-2 rounded-lg bg-green-50/60 border border-green-100/50">
                          <FileCheck className="h-3.5 w-3.5 text-green-600" />
                          <span className="text-muted-foreground">Devis</span>
                          <Badge variant="outline" className="ml-auto text-[10px] h-4 px-1.5 bg-white">{counts.devis}</Badge>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {counts.total === 0 && (
                  <div className="flex items-center gap-2 text-sm p-3 rounded-lg bg-gray-50/50 mb-3">
                    <FolderOpen className="h-4 w-4 text-muted-foreground/40" />
                    <span className="text-muted-foreground italic text-xs">
                      Aucun document associé. Créez une facture depuis le détail du projet.
                    </span>
                  </div>
                )}

                {/* Métadonnées */}
                <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground mb-3 pt-1">
                  <span>
                    Créé le {format(new Date(project.created_at), 'dd MMM yyyy', { locale: fr })}
                  </span>
                  {project.date_livraison && (
                    <span className={late ? 'text-red-600 font-semibold' : ''}>
                      · Livraison {format(new Date(project.date_livraison), 'dd MMM yyyy', { locale: fr })}
                      {late ? ' ⚠️' : ''}
                    </span>
                  )}
                </div>

                {/* Footer */}
                <div className="flex justify-end pt-2 border-t border-gray-100">
                  <Button
                    size="sm"
                    variant="default"
                    className="text-xs gap-1.5"
                    onClick={() => navigate(`/projects/${project.id}`)}
                  >
                    <FolderOpen className="h-3.5 w-3.5" /> Ouvrir le projet
                  </Button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
};
