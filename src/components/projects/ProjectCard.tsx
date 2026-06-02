
import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, FolderOpen } from "lucide-react";
import { Project } from '@/types/project';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useIsMobile } from '@/hooks/use-mobile';

interface ProjectCardProps {
  project: Project;
  onEdit: (project: Project) => void;
  onDelete: (id: string) => void;
  onView: (project: Project) => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, onEdit, onDelete, onView }) => {
  const createdAt = new Date(project.created_at);
  const updatedAt = new Date(project.updated_at);
  const isMobile = useIsMobile();
  
  // Count total templates
  const totalTemplates = 
    project.templates.factures.length +
    project.templates.commandes.length +
    project.templates.devis.length +
    project.templates.cahiers_des_charges.length;

  return (
    <Card className="w-full h-full flex flex-col transition-shadow hover:shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="flex justify-between items-center text-lg md:text-xl">
          <span className="truncate">{project.name}</span>
        </CardTitle>
        {project.description && (
          <CardDescription className="line-clamp-2 text-xs md:text-sm">
            {project.description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex-grow pb-0">
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs md:text-sm">
          <div className="col-span-2 flex justify-between items-center pb-1 border-b border-gray-100">
            <span className="font-medium">Documents</span>
            <span className="font-medium">{totalTemplates}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Factures</span>
            <span>{project.templates.factures.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Commandes</span>
            <span>{project.templates.commandes.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Devis</span>
            <span>{project.templates.devis.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">CdC</span>
            <span>{project.templates.cahiers_des_charges.length}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-t mt-3 pt-3 gap-2">
        <div className="text-xs text-muted-foreground">
          Mis à jour le {format(updatedAt, 'dd MMM yyyy', { locale: fr })}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onEdit(project)}
            className="flex-1 md:flex-initial flex justify-center"
          >
            <Edit className="h-4 w-4" />
            <span className={isMobile ? "sr-only" : "ml-1"}>Éditer</span>
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onDelete(project.id)}
            className="flex-1 md:flex-initial flex justify-center"
          >
            <Trash2 className="h-4 w-4" />
            <span className={isMobile ? "sr-only" : "ml-1"}>Supprimer</span>
          </Button>
          <Button 
            variant="default" 
            size="sm" 
            onClick={() => onView(project)}
            className="flex-1 md:flex-initial flex justify-center"
          >
            <FolderOpen className="h-4 w-4" />
            <span className={isMobile ? "sr-only" : "ml-1"}>Ouvrir</span>
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default ProjectCard;
