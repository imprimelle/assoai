import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '@/hooks/useProjects';
import { Project } from '@/types/project';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Search, Plus, FolderOpen, FileText, ShoppingCart,
  ClipboardList, FileCheck, Clock, ArrowRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useIsMobile } from '@/hooks/use-mobile';

interface ProjectsProps {
  user: { id: string; name?: string } | null;
  persistentSessionId: string | null;
}

// Constantes de phase
const PHASE_CONFIG: Record<string, { color: string; bg: string; label: string; icon: string }> = {
  'facturation': { color: 'text-blue-700', bg: 'bg-blue-50', label: 'Facturation', icon: '🔵' },
  'commande': { color: 'text-orange-700', bg: 'bg-orange-50', label: 'Commande', icon: '🟠' },
  'fabrication': { color: 'text-purple-700', bg: 'bg-purple-50', label: 'Fabrication', icon: '🟣' },
  'livraison': { color: 'text-green-700', bg: 'bg-green-50', label: 'Livraison', icon: '🟢' },
  'termine': { color: 'text-gray-500', bg: 'bg-gray-100', label: 'Terminé', icon: '⚫' },
};

const Projects: React.FC<ProjectsProps> = ({ user, persistentSessionId }) => {
  const navigate = useNavigate();
  const { projects, isLoading, createProject } = useProjects(persistentSessionId || undefined);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const isMobile = useIsMobile();

  // Filtrage
  const filtered = (projects || []).filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateProject = () => {
    // @todo: ouvrir le modal de création (recherche facture OU nouvelle)
    navigate('/chat?action=new-project');
  };

  const handleOpenProject = (projectId: string) => {
    navigate(`/projects/${projectId}`);
  };

  const getPhaseConfig = (phase?: string) => {
    return PHASE_CONFIG[phase || 'facturation'] || PHASE_CONFIG['facturation'];
  };

  const getTemplateCounts = (project: Project) => ({
    factures: project.templates.factures.length,
    commandes: project.templates.commandes.length,
    devis: project.templates.devis.length,
    cdCs: project.templates.cahiers_des_charges.length,
    total: project.templates.factures.length + project.templates.commandes.length +
           project.templates.devis.length + project.templates.cahiers_des_charges.length,
  });

  if (!user || !persistentSessionId) {
    return (
      <div className="container mx-auto px-4 py-6 md:py-8">
        <h1 className="text-xl md:text-2xl font-bold mb-6">Projets</h1>
        <p className="text-muted-foreground">Vous devez être connecté pour voir vos projets.</p>
      </div>
    );
  }

  return (
    <div className={`container mx-auto px-4 py-6 md:py-8 ${isMobile ? 'max-w-full' : ''}`}>
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <h1 className="text-xl md:text-2xl font-bold">Projets</h1>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un projet..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button onClick={handleCreateProject} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            <span className={isMobile ? 'sr-only' : ''}>Nouveau</span>
          </Button>
        </div>
      </div>

      {/* Liste */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground text-lg">
            {searchTerm ? 'Aucun projet ne correspond à votre recherche' : "Vous n'avez pas encore de projet"}
          </p>
          {!searchTerm && (
            <Button variant="outline" className="mt-4" onClick={handleCreateProject}>
              <Plus className="h-4 w-4 mr-2" /> Créer mon premier projet
            </Button>
          )}
        </div>
      ) : (
        <Accordion
          type="single"
          collapsible
          value={expandedProject || undefined}
          onValueChange={(val) => setExpandedProject(val || null)}
          className="space-y-3"
        >
          {filtered.map(project => {
            const phaseCfg = getPhaseConfig(project.phase);
            const counts = getTemplateCounts(project);

            return (
              <AccordionItem
                key={project.id}
                value={project.id}
                className="border rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow"
              >
                {/* En-tête de la carte — toujours visible */}
                <div className="flex items-center justify-between px-4 py-3">
                  <AccordionTrigger className="flex-1 hover:no-underline py-0">
                    <div className="flex items-center gap-3 text-left">
                      <span className="text-lg">{phaseCfg.icon}</span>
                      <div>
                        <h3 className="font-semibold text-base md:text-lg truncate max-w-[200px] sm:max-w-xs">
                          {project.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className={`text-xs ${phaseCfg.color} ${phaseCfg.bg} border-0`}>
                            {phaseCfg.label}
                          </Badge>
                          {project.date_livraison && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(project.date_livraison), 'dd MMM yyyy', { locale: fr })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>

                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <Badge variant="secondary" className="text-xs">
                      {counts.total} doc{counts.total !== 1 ? 's' : ''}
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenProject(project.id);
                      }}
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Contenu dépliable — accordéon */}
                <AccordionContent>
                  <div className="px-4 pb-4 pt-0 border-t">
                    {project.description && (
                      <p className="text-sm text-muted-foreground mb-3">{project.description}</p>
                    )}

                    {/* Section Documents */}
                    <div className="space-y-2">
                      {counts.factures > 0 && (
                        <div className="flex items-center gap-2 text-sm p-2 rounded bg-gray-50">
                          <FileText className="h-4 w-4 text-blue-600" />
                          <span className="text-muted-foreground">Factures</span>
                          <Badge variant="outline" className="ml-auto text-xs">{counts.factures}</Badge>
                        </div>
                      )}
                      {counts.commandes > 0 && (
                        <div className="flex items-center gap-2 text-sm p-2 rounded bg-gray-50">
                          <ShoppingCart className="h-4 w-4 text-orange-600" />
                          <span className="text-muted-foreground">Commandes</span>
                          <Badge variant="outline" className="ml-auto text-xs">{counts.commandes}</Badge>
                        </div>
                      )}
                      {counts.cdCs > 0 && (
                        <div className="flex items-center gap-2 text-sm p-2 rounded bg-gray-50">
                          <ClipboardList className="h-4 w-4 text-purple-600" />
                          <span className="text-muted-foreground">Cahiers des charges</span>
                          <Badge variant="outline" className="ml-auto text-xs">{counts.cdCs}</Badge>
                        </div>
                      )}
                      {counts.devis > 0 && (
                        <div className="flex items-center gap-2 text-sm p-2 rounded bg-gray-50">
                          <FileCheck className="h-4 w-4 text-green-600" />
                          <span className="text-muted-foreground">Devis</span>
                          <Badge variant="outline" className="ml-auto text-xs">{counts.devis}</Badge>
                        </div>
                      )}
                    </div>

                    {counts.total === 0 && (
                      <p className="text-sm text-muted-foreground italic">
                        Aucun document associé. Utilisez le chat pour créer une facture.
                      </p>
                    )}

                    <div className="mt-3 pt-3 border-t flex justify-end">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleOpenProject(project.id)}
                      >
                        <FolderOpen className="h-4 w-4 mr-1" /> Ouvrir le projet
                      </Button>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
};

export default Projects;
