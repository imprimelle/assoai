
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Project, ProjectFormData, normalizeProject, normalizeTemplates, projectTemplatesToJson, Json } from '@/types/project';
import { useToast } from '@/hooks/use-toast';
import { appLogger } from '@/utils/logger';

const PRIVILEGED_ROLES: string[] = ['directeur', 'directrice_adjointe', 'commerciale'];

export const useProjects = (userId?: string, userRole?: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch all projects
  const { data: projects, isLoading, error } = useQuery({
    queryKey: ['projects', userId, userRole],
    queryFn: async () => {
      appLogger.info('useProjects - Chargement des projets', { userId, userRole });
      
      const isPrivileged = userRole && PRIVILEGED_ROLES.includes(userRole);
      
      let query = supabase
        .from('projects')
        .select('*')
        .order('updated_at', { ascending: false });
      
      // Filter by user (created_by) ONLY for non-privileged roles
      if (userId && !isPrivileged) {
        query = query.eq('created_by', userId);
      }

      const { data, error } = await query;
      
      if (error) {
        appLogger.error('useProjects - Erreur lors du chargement des projets', { error });
        console.error('Error fetching projects:', error);
        throw new Error(error.message);
      }
      
      // Normalize each project data
      const normalizedProjects = (data || []).map(rawProject => {
        const normalized = normalizeProject(rawProject);
        appLogger.info('useProjects - Projet normalisé', {
          projectId: normalized.id,
          projectName: normalized.name,
          templateCounts: {
            factures: normalized.templates.factures.length,
            commandes: normalized.templates.commandes.length,
            devis: normalized.templates.devis.length,
            cahiers_des_charges: normalized.templates.cahiers_des_charges.length
          }
        });
        return normalized;
      });
      
      return normalizedProjects;
    },
    enabled: !!userId, // Only run if userId is provided
  });

  // Create a new project
  const createProject = useMutation({
    mutationFn: async ({ project, userId, userSessionId }: { 
      project: ProjectFormData, 
      userId: string, 
      userSessionId: string 
    }) => {
      const { data, error } = await supabase
        .from('projects')
        .insert({
          name: project.name,
          description: project.description,
          created_by: userId,
          session_id: userSessionId,
        })
        .select();

      if (error) {
        console.error('Error creating project:', error);
        throw new Error(error.message);
      }

      return normalizeProject(data[0]);
    },
    onSuccess: (newProject) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast({
        title: "Projet créé",
        description: `Le projet "${newProject.name}" a été créé avec succès.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: `Erreur lors de la création du projet: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Update an existing project
  const updateProject = useMutation({
    mutationFn: async ({ id, project }: { id: string, project: Partial<ProjectFormData> }) => {
      const { data, error } = await supabase
        .from('projects')
        .update({
          name: project.name,
          description: project.description,
        })
        .eq('id', id)
        .select();

      if (error) {
        console.error('Error updating project:', error);
        throw new Error(error.message);
      }

      return normalizeProject(data[0]);
    },
    onSuccess: (updatedProject) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast({
        title: "Projet mis à jour",
        description: `Le projet "${updatedProject.name}" a été mis à jour avec succès.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: `Erreur lors de la mise à jour du projet: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Delete a project — nettoyage complet de toutes les tables liées
  const deleteProject = useMutation({
    mutationFn: async (id: string) => {
      // Ordre de suppression dicté par la chaîne FK (réf: project-cleanup-fk-chain.md)
      // 1. Supprimer les checklists
      const { error: errCl } = await supabase.from('checklists').delete().eq('project_id', id);
      if (errCl) console.error('deleteProject: checklists error', errCl);

      // 2. Supprimer la queue de communication
      const { error: errCq } = await supabase.from('communicator_queue').delete().eq('project_id', id);
      if (errCq) console.error('deleteProject: communicator_queue error', errCq);

      // 3. Délier les messages (mettre project_id à NULL au lieu de supprimer)
      const { error: errMsg } = await supabase.from('messages').update({ project_id: null }).eq('project_id', id);
      if (errMsg) console.error('deleteProject: messages error', errMsg);

      // 4. Supprimer les contacts projet
      const { error: errPc } = await supabase.from('project_contacts').delete().eq('project_id', id);
      if (errPc) console.error('deleteProject: project_contacts error', errPc);

      // 5. Supprimer l'historique des phases
      const { error: errPh } = await supabase.from('project_phase_history').delete().eq('project_id', id);
      if (errPh) console.error('deleteProject: project_phase_history error', errPh);

      // 6. Supprimer les tâches Kanban
      const { error: errPt } = await supabase.from('project_tasks').delete().eq('project_id', id);
      if (errPt) console.error('deleteProject: project_tasks error', errPt);

      // 7. Enfin, supprimer le projet lui-même
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) {
        console.error('Error deleting project:', error);
        throw new Error(error.message);
      }

      return id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['checklists'] });
      queryClient.invalidateQueries({ queryKey: ['project-health'] });
      queryClient.invalidateQueries({ queryKey: ['project-documents'] });
      toast({
        title: 'Projet supprimé',
        description: 'Le projet et toutes ses données associées (tâches, checklists, communications) ont été nettoyés.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: `Erreur lors de la suppression du projet : ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Add a template to a project
  const addTemplateToProject = useMutation({
    mutationFn: async ({ 
      projectId, 
      templateType, 
      templateId 
    }: { 
      projectId: string, 
      templateType: string, 
      templateId: string 
    }) => {
      appLogger.info('useProjects - Ajout de template', {
        projectId,
        templateType,
        templateId
      });
      
      // First, get the current project
      const { data: projectData, error: fetchError } = await supabase
        .from('projects')
        .select('templates')
        .eq('id', projectId)
        .single();

      if (fetchError) {
        appLogger.error('useProjects - Erreur lors de la récupération du projet', { fetchError });
        console.error('Error fetching project:', fetchError);
        throw new Error(fetchError.message);
      }

      // Normalize templates to ensure proper structure
      const templates = normalizeTemplates(projectData.templates);
      appLogger.info('useProjects - Templates avant ajout', {
        templateCounts: {
          factures: templates.factures.length,
          commandes: templates.commandes.length,
          devis: templates.devis.length,
          cahiers_des_charges: templates.cahiers_des_charges.length
        }
      });
      
      // Add the template ID to the appropriate array if it doesn't exist yet
      const templateTypeKey = templateType === 'cahier_des_charges' 
        ? 'cahiers_des_charges' 
        : `${templateType}s`;
      
      // Type guard for valid template type key
      if (templateTypeKey in templates) {
        const typedKey = templateTypeKey as keyof typeof templates;
        if (!templates[typedKey].includes(templateId)) {
          templates[typedKey] = [...templates[typedKey], templateId];
          appLogger.info('useProjects - Template ajouté à la liste', {
            templateType: templateTypeKey,
            templateId,
            newCount: templates[typedKey].length
          });
        } else {
          appLogger.info('useProjects - Template déjà dans la liste, ignoré', {
            templateType: templateTypeKey,
            templateId
          });
        }
      }

      // Convert templates to Json for Supabase update
      const templatesJson = projectTemplatesToJson(templates);

      // Update the project
      const { data, error } = await supabase
        .from('projects')
        .update({ templates: templatesJson })
        .eq('id', projectId)
        .select();

      if (error) {
        appLogger.error('useProjects - Erreur lors de l\'ajout du template', { error });
        console.error('Error adding template to project:', error);
        throw new Error(error.message);
      }

      const updatedProject = normalizeProject(data[0]);
      appLogger.info('useProjects - Projet mis à jour avec nouveau template', {
        projectId: updatedProject.id,
        templateCounts: {
          factures: updatedProject.templates.factures.length,
          commandes: updatedProject.templates.commandes.length,
          devis: updatedProject.templates.devis.length,
          cahiers_des_charges: updatedProject.templates.cahiers_des_charges.length
        }
      });
      
      return updatedProject;
    },
    onSuccess: (updatedProject) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast({
        title: "Template ajouté",
        description: `Le document a été ajouté au projet "${updatedProject.name}".`,
      });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: `Erreur lors de l'ajout du document au projet: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Remove a template from a project
  const removeTemplateFromProject = useMutation({
    mutationFn: async ({ 
      projectId, 
      templateType, 
      templateId 
    }: { 
      projectId: string, 
      templateType: string, 
      templateId: string 
    }) => {
      appLogger.info('useProjects - Retrait de template', {
        projectId,
        templateType,
        templateId
      });
      
      // First, get the current project
      const { data: projectData, error: fetchError } = await supabase
        .from('projects')
        .select('templates')
        .eq('id', projectId)
        .single();

      if (fetchError) {
        appLogger.error('useProjects - Erreur lors de la récupération du projet', { fetchError });
        console.error('Error fetching project:', fetchError);
        throw new Error(fetchError.message);
      }

      // Normalize templates to ensure proper structure
      const templates = normalizeTemplates(projectData.templates);
      appLogger.info('useProjects - Templates avant retrait', {
        templateCounts: {
          factures: templates.factures.length,
          commandes: templates.commandes.length,
          devis: templates.devis.length,
          cahiers_des_charges: templates.cahiers_des_charges.length
        }
      });
      
      // Remove the template ID from the appropriate array
      const templateTypeKey = templateType === 'cahier_des_charges' 
        ? 'cahiers_des_charges' 
        : `${templateType}s`;
      
      // Type guard for valid template type key
      if (templateTypeKey in templates) {
        const typedKey = templateTypeKey as keyof typeof templates;
        const previousCount = templates[typedKey].length;
        templates[typedKey] = templates[typedKey].filter(id => id !== templateId);
        
        if (templates[typedKey].length < previousCount) {
          appLogger.info('useProjects - Template retiré de la liste', {
            templateType: templateTypeKey,
            templateId,
            previousCount,
            newCount: templates[typedKey].length
          });
        } else {
          appLogger.warning('useProjects - Template non trouvé dans la liste', {
            templateType: templateTypeKey,
            templateId,
            listIds: templates[typedKey]
          });
        }
      }

      // Convert templates to Json for Supabase update
      const templatesJson = projectTemplatesToJson(templates);

      // Update the project
      const { data, error } = await supabase
        .from('projects')
        .update({ templates: templatesJson })
        .eq('id', projectId)
        .select();

      if (error) {
        appLogger.error('useProjects - Erreur lors du retrait du template', { error });
        console.error('Error removing template from project:', error);
        throw new Error(error.message);
      }

      const updatedProject = normalizeProject(data[0]);
      appLogger.info('useProjects - Projet mis à jour après retrait de template', {
        projectId: updatedProject.id,
        templateCounts: {
          factures: updatedProject.templates.factures.length,
          commandes: updatedProject.templates.commandes.length,
          devis: updatedProject.templates.devis.length,
          cahiers_des_charges: updatedProject.templates.cahiers_des_charges.length
        }
      });
      
      return updatedProject;
    },
    onSuccess: (updatedProject) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast({
        title: "Template retiré",
        description: `Le document a été retiré du projet "${updatedProject.name}".`,
      });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: `Erreur lors du retrait du document du projet: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  return {
    projects,
    isLoading,
    error,
    createProject,
    updateProject,
    deleteProject,
    addTemplateToProject,
    removeTemplateFromProject,
  };
};
