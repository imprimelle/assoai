
import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from 'react-hook-form';
import { Project, ProjectFormData } from '@/types/project';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ProjectFormData) => void;
  project?: Project;
  title: string;
}

const ProjectModal: React.FC<ProjectModalProps> = ({ isOpen, onClose, onSubmit, project, title }) => {
  const { register, handleSubmit, formState: { errors } } = useForm<ProjectFormData>({
    defaultValues: {
      name: project?.name || '',
      description: project?.description || '',
    }
  });

  const submitForm = (data: ProjectFormData) => {
    onSubmit(data);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit(submitForm)}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {project ? "Modifiez les détails du projet." : "Créez un nouveau projet pour organiser vos documents."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nom du projet</Label>
              <Input
                id="name"
                placeholder="Entrez le nom du projet"
                {...register('name', { required: "Le nom est requis" })}
              />
              {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optionnelle)</Label>
              <Textarea
                id="description"
                placeholder="Entrez une description pour ce projet"
                {...register('description')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={onClose}>Annuler</Button>
            <Button type="submit">{project ? "Mettre à jour" : "Créer le projet"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ProjectModal;
