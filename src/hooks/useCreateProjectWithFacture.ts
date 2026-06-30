import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { DocumentSearchResult } from './useDocumentSearch';
import type { FactureData } from '@/types';
import { appLogger } from '@/utils/logger';

interface CreateProjectInput {
  userId: string;
  userSessionId: string;
}

interface CreateFromExistingInput extends CreateProjectInput {
  doc: DocumentSearchResult;
}

interface CreateFromNewInput extends CreateProjectInput {
  factureData: FactureData;
}

/**
 * Génère un numéro de facture temporaire.
 * Format: F-YYYYMMDD-XXXXX
 * Le numéro définitif sera attribué par next_document_number() RPC
 * lors du premier traitement par l'agent Hermes.
 */
function generateTempFactureNumber(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `F-${datePart}-${randomPart}`;
}

export const useCreateProjectWithFacture = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  /**
   * Mode A : Créer un projet à partir d'une facture existante.
   */
  const createFromExisting = useMutation({
    mutationFn: async ({ doc, userId, userSessionId }: CreateFromExistingInput) => {
      const projectName = doc.client || 'Sans client';

      appLogger.info('createFromExisting - Début', {
        factureNumero: doc.numero,
        client: doc.client,
        projectName,
      });

      // 1. Créer le projet
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .insert({
          name: projectName,
          description: `Projet créé depuis la facture ${doc.numero}`,
          created_by: userId,
          session_id: userSessionId,
        })
        .select()
        .single();

      if (projectError || !projectData) {
        appLogger.error('createFromExisting - Erreur création projet', { error: projectError });
        throw new Error(projectError?.message || 'Erreur création projet');
      }

      const projectId = projectData.id;
      appLogger.info('createFromExisting - Projet créé', { projectId, projectName });

      // 2. Lier la facture au projet
      const { error: linkError } = await supabase
        .from('messages')
        .update({ project_id: projectId })
        .eq('id', doc.id);

      if (linkError) {
        appLogger.error('createFromExisting - Erreur liaison facture', { error: linkError });
        throw new Error(linkError.message);
      }

      // 3. Ajouter la facture aux templates du projet
      const { data: currentProject, error: fetchError } = await supabase
        .from('projects')
        .select('templates')
        .eq('id', projectId)
        .single();

      if (fetchError) {
        appLogger.error('createFromExisting - Erreur lecture templates', { error: fetchError });
        throw new Error(fetchError.message);
      }

      const templates = (currentProject?.templates as any) || {};
      const factures = Array.isArray(templates.factures) ? [...templates.factures] : [];
      if (!factures.includes(doc.id)) {
        factures.push(doc.id);
      }

      const { error: updateError } = await supabase
        .from('projects')
        .update({
          templates: {
            ...templates,
            factures,
          },
        })
        .eq('id', projectId);

      if (updateError) {
        appLogger.error('createFromExisting - Erreur mise à jour templates', { error: updateError });
        throw new Error(updateError.message);
      }

      return { projectId, projectName };
    },
    onSuccess: ({ projectId, projectName }) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['document-search'] });
      queryClient.invalidateQueries({ queryKey: ['project-documents', projectId] });
      toast({
        title: 'Projet créé',
        description: `Le projet "${projectName}" a été créé avec sa facture attachée.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur',
        description: `Erreur lors de la création du projet : ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  /**
   * Mode B : Créer un projet ET une nouvelle facture à partir du formulaire.
   */
  const createFromNew = useMutation({
    mutationFn: async ({ factureData, userId, userSessionId }: CreateFromNewInput) => {
      const projectName = factureData.client?.nom || 'Sans client';
      const factureNumero = factureData.factureNumero || generateTempFactureNumber();

      appLogger.info('createFromNew - Début', {
        client: factureData.client?.nom,
        projectName,
        factureNumero,
      });

      // 1. Créer le projet
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .insert({
          name: projectName,
          description: `Projet créé pour ${factureData.client?.nom || 'client'}`,
          created_by: userId,
          session_id: userSessionId,
        })
        .select()
        .single();

      if (projectError || !projectData) {
        appLogger.error('createFromNew - Erreur création projet', { error: projectError });
        throw new Error(projectError?.message || 'Erreur création projet');
      }

      const projectId = projectData.id;
      appLogger.info('createFromNew - Projet créé', { projectId, projectName });

      // 2. Sauvegarder la facture dans messages
      const templateData = {
        ...factureData,
        factureNumero,
        version: 1,
        is_latest: true,
      };

      const messageId = crypto.randomUUID();
      const { error: insertError } = await supabase
        .from('messages')
        .insert({
          id: messageId,
          session_id: `project-${projectId}`,
          user_id: userId,
          sender: 'ai', // Important : 'ai' pour être traité comme un document
          content: `Facture ${factureNumero} créée manuellement`,
          template_type: 'facture',
          template_data: { data: templateData },
          project_id: projectId,
          session_type: 'project',
          timestamp: new Date().toISOString(),
        });

      if (insertError) {
        appLogger.error('createFromNew - Erreur insertion facture', { error: insertError });
        throw new Error(insertError.message);
      }

      appLogger.info('createFromNew - Facture sauvegardée', { messageId, factureNumero });

      // 3. Ajouter la facture aux templates du projet
      const { error: updateError } = await supabase
        .from('projects')
        .update({
          templates: {
            factures: [messageId],
            commandes: [],
            devis: [],
            cahiers_des_charges: [],
          },
        })
        .eq('id', projectId);

      if (updateError) {
        appLogger.error('createFromNew - Erreur mise à jour templates', { error: updateError });
        throw new Error(updateError.message);
      }

      return { projectId, projectName, messageId, factureNumero };
    },
    onSuccess: ({ projectId, projectName, factureNumero }) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['document-search'] });
      queryClient.invalidateQueries({ queryKey: ['project-documents', projectId] });
      toast({
        title: 'Projet et facture créés',
        description: `Le projet "${projectName}" et la facture ${factureNumero} ont été créés.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur',
        description: `Erreur lors de la création : ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  return {
    createFromExisting,
    createFromNew,
  };
};
