
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useProjects } from '@/hooks/useProjects';
import { Project } from '@/types/project';
import { TemplateType } from '@/types/template';
import { Loader2 } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

interface AddToProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  templateId: string;
  templateType: TemplateType;
  sessionId: string;
}

const AddToProjectModal: React.FC<AddToProjectModalProps> = ({ 
  isOpen, 
  onClose, 
  templateId, 
  templateType,
  sessionId
}) => {
  const { projects, isLoading, addTemplateToProject } = useProjects(sessionId);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  const handleAddToProject = () => {
    if (!selectedProjectId) return;
    
    addTemplateToProject.mutate({ 
      projectId: selectedProjectId, 
      templateType, 
      templateId 
    }, {
      onSuccess: () => {
        onClose();
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Ajouter à un projet</DialogTitle>
          <DialogDescription>
            Sélectionnez un projet auquel ajouter ce document.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          {isLoading ? (
            <div className="flex items-center justify-center p-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (projects && projects.length > 0) ? (
            <RadioGroup value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <div className="space-y-2">
                {projects.map((project) => (
                  <div key={project.id} className="flex items-center space-x-2">
                    <RadioGroupItem id={project.id} value={project.id} />
                    <Label htmlFor={project.id} className="cursor-pointer">
                      <span className="font-medium">{project.name}</span>
                      {project.description && (
                        <span className="block text-xs text-muted-foreground">
                          {project.description}
                        </span>
                      )}
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          ) : (
            <div className="text-center py-4">
              <p className="text-muted-foreground">
                Vous n'avez pas encore créé de projet. Créez d'abord un projet pour y ajouter ce document.
              </p>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={handleAddToProject} disabled={!selectedProjectId || addTemplateToProject.isPending}>
            {addTemplateToProject.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Ajouter au projet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddToProjectModal;
