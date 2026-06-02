
import React, { useState } from 'react';
import { Project, ProjectFormData } from '@/types/project';
import { useProjects } from '@/hooks/useProjects';
import ProjectCard from './ProjectCard';
import ProjectModal from './ProjectModal';
import { Button } from '@/components/ui/button';
import { Plus, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-mobile';

interface ProjectListProps {
  sessionId: string;
  userId: string;
}

const ProjectList: React.FC<ProjectListProps> = ({ sessionId, userId }) => {
  const navigate = useNavigate();
  const { projects, isLoading, createProject, updateProject, deleteProject } = useProjects(sessionId);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const isMobile = useIsMobile();

  const handleCreateProject = (projectData: ProjectFormData) => {
    createProject.mutate({
      project: projectData,
      userId,
      userSessionId: sessionId,
    });
  };

  const handleUpdateProject = (projectData: ProjectFormData) => {
    if (!selectedProject) return;
    updateProject.mutate({
      id: selectedProject.id,
      project: projectData,
    });
  };

  const openEditModal = (project: Project) => {
    setSelectedProject(project);
    setIsEditModalOpen(true);
  };

  const confirmDelete = (projectId: string) => {
    const project = projects?.find(p => p.id === projectId);
    setSelectedProject(project || null);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteProject = () => {
    if (!selectedProject) return;
    deleteProject.mutate(selectedProject.id);
    setIsDeleteDialogOpen(false);
  };

  const handleViewProject = (project: Project) => {
    navigate(`/projects/${project.id}`);
  };

  // Filter projects by search term
  const filteredProjects = projects?.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (project.description && project.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher des projets..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)} className="w-full sm:w-auto flex items-center">
          <Plus className="h-4 w-4 mr-2" />
          <span>Nouveau Projet</span>
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          // Skeleton loader while loading
          Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-[200px] w-full" />
          ))
        ) : filteredProjects && filteredProjects.length > 0 ? (
          // Show filtered projects
          filteredProjects.map(project => (
            <ProjectCard
              key={project.id}
              project={project}
              onEdit={openEditModal}
              onDelete={confirmDelete}
              onView={handleViewProject}
            />
          ))
        ) : (
          // No projects or no results found
          <div className="col-span-full text-center py-8 md:py-12">
            <p className="text-muted-foreground">
              {searchTerm ? "Aucun projet ne correspond à votre recherche" : "Aucun projet n'a été créé. Commencez par en créer un nouveau."}
            </p>
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      <ProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateProject}
        title="Créer un nouveau projet"
      />

      {/* Edit Project Modal */}
      {selectedProject && (
        <ProjectModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSubmit={handleUpdateProject}
          project={selectedProject}
          title="Modifier le projet"
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="max-w-[90vw] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action ne peut pas être annulée. Cela supprimera définitivement le projet
              {selectedProject && <strong> "{selectedProject.name}"</strong>} et toutes ses associations avec des documents.
              <br /><br />
              <em className="text-sm">Note: Les documents eux-mêmes ne seront pas supprimés, seulement leurs liens avec ce projet.</em>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="w-full sm:w-auto">Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProject} className="w-full sm:w-auto bg-red-500 hover:bg-red-600">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProjectList;
