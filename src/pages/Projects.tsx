
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ProjectList } from '@/components/projects';
import ProjectDetails from '@/components/projects/ProjectDetails';
import { useProjects } from '@/hooks/useProjects';
import { Skeleton } from '@/components/ui/skeleton';
import { User } from '@/types';
import { useIsMobile } from '@/hooks/use-mobile';

interface ProjectsProps {
  user: User | null;
  persistentSessionId: string | null;
}

const Projects: React.FC<ProjectsProps> = ({ user, persistentSessionId }) => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { projects, isLoading } = useProjects(persistentSessionId || undefined);
  const isMobile = useIsMobile();

  // Find the selected project if projectId is provided
  const selectedProject = projectId && projects 
    ? projects.find(p => p.id === projectId) 
    : null;

  const handleBackToList = () => {
    navigate('/projects');
  };

  const handleContinueInChat = () => {
    navigate('/chat');
  };

  if (!user || !persistentSessionId) {
    return (
      <div className="container mx-auto px-4 py-6 md:py-8">
        <h1 className="text-xl md:text-2xl font-bold mb-6">Projets</h1>
        <p>Vous devez être connecté pour voir vos projets.</p>
      </div>
    );
  }

  return (
    <div className={`container mx-auto px-4 py-6 md:py-8 ${isMobile ? 'max-w-full' : ''}`}>
      {projectId ? (
        isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-full" />
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-32 w-full" />
              ))}
            </div>
          </div>
        ) : selectedProject ? (
          <ProjectDetails 
            project={selectedProject} 
            onBack={handleBackToList}
            onContinueInChat={handleContinueInChat}
            user={user}
          />
        ) : (
          <div className="text-center py-8 md:py-12">
            <p className="text-muted-foreground">
              Projet introuvable. Il est possible qu'il ait été supprimé.
            </p>
            <button
              className="mt-4 text-brand-orange hover:underline"
              onClick={handleBackToList}
            >
              Retour à la liste des projets
            </button>
          </div>
        )
      ) : (
        <>
          <h1 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">Projets</h1>
          <ProjectList sessionId={persistentSessionId} userId={user.id} />
        </>
      )}
    </div>
  );
};

export default Projects;
