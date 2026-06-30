import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '@/hooks/useProjects';
import { Project } from '@/types/project';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Plus, FolderOpen, Trash2, AlertTriangle, Loader2,
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { ProjectSearchWidget, type SearchSuggestion } from '@/components/projects/ProjectSearchWidget';
import { useProjectsDocumentCounts } from '@/hooks/useProjectsDocumentCounts';
import { CreateProjectModal } from '@/components/projects/CreateProjectModal';
import { ViewSelector, type ProjectView } from '@/components/projects/ViewSelector';
import { ProjectListView } from '@/components/projects/ProjectListView';
import { ProjectKanbanView } from '@/components/projects/ProjectKanbanView';
import { ProjectCalendarView } from '@/components/projects/ProjectCalendarView';
import { ProjectMapView } from '@/components/projects/ProjectMapView';
import { ProjectFilterBar, type ProjectFilters } from '@/components/projects/ProjectFilterBar';
import { useProjectsHealth } from '@/hooks/useProjectsHealth';
import { useProjectsTaskCounts } from '@/hooks/useProjectsTaskCounts';
import { useProjectsAddresses } from '@/hooks/useProjectsAddresses';
import { useProjectsInitDates } from '@/hooks/useProjectsInitDates';
import { supabase } from '@/integrations/supabase/client';
import { usePageVisit } from '@/hooks/usePageVisit';

const PHASE_CONFIG_ICON: Record<string, string> = {
  'facturation': '🔵',
  'commande': '🟠',
  'fabrication': '🟣',
  'livraison': '🟢',
  'termine': '⚫',
};

interface ProjectsProps {
  user: { id: string; name?: string } | null;
  persistentSessionId: string | null;
}

const Projects: React.FC<ProjectsProps> = ({ user, persistentSessionId }) => {
  const navigate = useNavigate();
  const { projects, isLoading, deleteProject } = useProjects(user?.id, user?.role);
  const [view, setView] = useState<ProjectView>('kanban');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [filters, setFilters] = useState<ProjectFilters>({ phases: [], sort: 'date-desc' });
  const isMobile = useIsMobile();
  const { recordVisit } = usePageVisit();

  // Enregistrer la visite pour les compteurs
  useEffect(() => {
    if (user) recordVisit(user.id, "projets");
  }, [user, recordVisit]);

  // Données batch (lazy par vue)
  const projectIds = (projects || []).map(p => p.id);
  const docCounts = useProjectsDocumentCounts(projectIds);
  const healthScores = useProjectsHealth(projectIds, view === 'kanban');
  const taskCounts = useProjectsTaskCounts(projectIds, view === 'kanban' || view === 'list');
  const addresses = useProjectsAddresses(projectIds, view === 'map');
  const initDates = useProjectsInitDates(projectIds, view === 'calendar');

  // Filtrage + tri
  const filtered = useMemo(() => {
    let result = (projects || []).filter(p => {
      // Recherche texte
      const matchesSearch =
        !searchTerm ||
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.description || '').toLowerCase().includes(searchTerm.toLowerCase());

      // Filtre phases
      const matchesPhase = filters.phases.length === 0 || filters.phases.includes(p.phase || 'facturation');

      return matchesSearch && matchesPhase;
    });

    // Tri
    result = [...result].sort((a, b) => {
      switch (filters.sort) {
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'date-asc':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'date-desc':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'livraison-asc': {
          const da = a.date_livraison ? new Date(a.date_livraison).getTime() : Infinity;
          const db = b.date_livraison ? new Date(b.date_livraison).getTime() : Infinity;
          return da - db;
        }
        case 'livraison-desc': {
          const da = a.date_livraison ? new Date(a.date_livraison).getTime() : -Infinity;
          const db = b.date_livraison ? new Date(b.date_livraison).getTime() : -Infinity;
          return db - da;
        }
        case 'health-desc': {
          const ha = healthScores.get(a.id)?.healthScore ?? 0;
          const hb = healthScores.get(b.id)?.healthScore ?? 0;
          return hb - ha;
        }
        case 'health-asc': {
          const ha = healthScores.get(a.id)?.healthScore ?? 0;
          const hb = healthScores.get(b.id)?.healthScore ?? 0;
          return ha - hb;
        }
        case 'docs-desc': {
          const da = docCounts.get(a.id)?.total ?? 0;
          const db = docCounts.get(b.id)?.total ?? 0;
          return db - da;
        }
        case 'docs-asc': {
          const da = docCounts.get(a.id)?.total ?? 0;
          const db = docCounts.get(b.id)?.total ?? 0;
          return da - db;
        }
        default:
          return 0;
      }
    });

    return result;
  }, [projects, searchTerm, filters, healthScores, docCounts]);

  const handleCreateProject = () => {
    setShowCreateDialog(true);
  };

  const handleDeleteProject = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteProject.mutateAsync(deleteTarget.id);
      supabase.from('communicator_queue').insert({
        project_id: deleteTarget.id,
        direction: 'pm_to_communicator',
        action: 'project_deleted',
        status: 'pending',
        payload: { project_name: deleteTarget.name, project_id: deleteTarget.id },
      }).then(({ error }) => {
        if (error) console.error('Queue project_deleted insert error:', error);
      });
      setDeleteTarget(null);
    } catch {
    } finally {
      setDeleting(false);
    }
  };

  // Suggestions de recherche
  const searchSuggestions: SearchSuggestion[] = useMemo(() => {
    if (!searchTerm || !projects) return [];
    return filtered.slice(0, 5).map(p => {
      const icon = p.phase ? PHASE_CONFIG_ICON[p.phase] : undefined;
      return {
        id: p.id,
        label: p.name,
        subtitle: p.date_livraison
          ? `Livraison ${new Date(p.date_livraison).toLocaleDateString('fr')}`
          : undefined,
        icon,
        onClick: () => navigate(`/projects/${p.id}`),
      };
    });
  }, [searchTerm, filtered, projects]);

  // === RENDU ===

  if (!user || !persistentSessionId) {
    return (
      <div className="container mx-auto px-4 py-6 md:py-8">
        <h1 className="text-xl md:text-2xl font-bold mb-6">Projets</h1>
        <p className="text-muted-foreground">Vous devez être connecté pour voir vos projets.</p>
      </div>
    );
  }

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      );
    }

    if (filtered.length === 0) {
      return (
        <div className="text-center py-16">
          <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground text-lg">
            {searchTerm || filters.phases.length > 0
              ? 'Aucun projet ne correspond à vos critères'
              : (user?.role && ['directeur', 'directrice_adjointe', 'commerciale'].includes(user.role)
                ? 'Aucun projet pour le moment'
                : "Vous n'avez pas encore de projet")}
          </p>
          {!searchTerm && filters.phases.length === 0 && (
            <Button variant="outline" className="mt-4" onClick={handleCreateProject}>
              <Plus className="h-4 w-4 mr-2" /> Créer mon premier projet
            </Button>
          )}
        </div>
      );
    }

    switch (view) {
      case 'kanban':
        return (
          <ProjectKanbanView
            projects={filtered}
            healthScores={healthScores}
            taskCounts={taskCounts}
            docCounts={docCounts}
          />
        );
      case 'calendar':
        return <ProjectCalendarView projects={filtered} initDates={initDates} />;
      case 'map':
        return (
          <ProjectMapView
            addresses={addresses}
            projects={filtered}
          />
        );
      case 'list':
      default:
        return (
          <ProjectListView
            projects={filtered}
            docCounts={docCounts}
            taskCounts={taskCounts}
            expandedProject={expandedProject}
            onExpand={setExpandedProject}
            onDelete={(project) => setDeleteTarget({ id: project.id, name: project.name })}
          />
        );
    }
  };

  return (
    <div className={`container mx-auto px-4 py-6 md:py-8 ${isMobile ? 'max-w-full' : ''}`}>
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <h1 className="text-xl md:text-2xl font-bold">Projets</h1>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <ProjectSearchWidget
            value={searchTerm}
            onChange={setSearchTerm}
            suggestions={searchSuggestions}
            className="flex-1 sm:w-64"
          />
          <Button onClick={handleCreateProject} className="flex items-center gap-2 shrink-0">
            <Plus className="h-4 w-4" />
            <span className={isMobile ? 'sr-only' : ''}>Nouveau</span>
          </Button>
        </div>
      </div>

      {/* Sélecteur de vues + Filtres */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <ViewSelector active={view} onChange={setView} />
        <ProjectFilterBar
          filters={filters}
          onChange={setFilters}
          activeCount={filtered.length}
          totalCount={(projects || []).length}
        />
      </div>

      {/* Contenu de la vue active — avec transition */}
      <div
        key={view}
        className="animate-in fade-in slide-in-from-bottom-2 duration-300"
      >
        {renderContent()}
      </div>

      {/* Modal de création */}
      {user && persistentSessionId && (
        <CreateProjectModal
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          userId={user.id}
          userSessionId={persistentSessionId}
          onProjectCreated={(projectId) => navigate(`/projects/${projectId}`)}
        />
      )}

      {/* Dialogue de confirmation de suppression */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Supprimer le projet
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm">
              Vous allez supprimer définitivement le projet <strong>« {deleteTarget?.name} »</strong>.
            </p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800 space-y-1">
              <p className="font-medium">⚠️ Cette action est irréversible :</p>
              <ul className="list-disc list-inside text-xs space-y-0.5">
                <li>Toutes les tâches Kanban seront supprimées</li>
                <li>Toutes les checklists seront supprimées</li>
                <li>Les documents seront détachés du projet</li>
                <li>Les communications WhatsApp seront nettoyées</li>
              </ul>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteProject}
              disabled={deleting}
              className="gap-2"
            >
              {deleting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Suppression...</>
              ) : (
                <><Trash2 className="h-4 w-4" /> Supprimer définitivement</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Projects;
