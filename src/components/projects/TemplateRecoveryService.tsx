
import React, { useEffect, useCallback } from 'react';
import { RetryService } from '@/services/retryService';
import { useProjects } from '@/hooks/useProjects';
import { appLogger } from '@/utils/logger';
import { toast } from '@/hooks/use-toast';

interface TemplateRecoveryServiceProps {
  projectId: string;
  sessionId: string;
  pendingGenerations: Array<{
    id: string;
    templateType: string;
    expectedIdentifier?: string;
    timestamp: number;
    sourceType?: string;
  }>;
  onRecovery?: (templateId: string, templateType: string) => void;
}

const TemplateRecoveryService: React.FC<TemplateRecoveryServiceProps> = ({
  projectId,
  sessionId,
  pendingGenerations,
  onRecovery
}) => {
  const { addTemplateToProject } = useProjects(sessionId);

  const checkForRecoveredTemplates = useCallback(async () => {
    if (pendingGenerations.length === 0) return;

    appLogger.info('🔍 Vérification des templates récupérables', {
      projectId,
      pendingCount: pendingGenerations.length
    });

    for (const pending of pendingGenerations) {
      try {
        // Vérifier si le template a été créé malgré l'erreur de fetch
        if (pending.expectedIdentifier) {
          const exists = await RetryService.checkTemplateExists(
            pending.templateType,
            pending.expectedIdentifier,
            30000 // 30 secondes pour chaque vérification
          );

          if (exists) {
            appLogger.info('✅ Template récupéré avec succès', {
              templateType: pending.templateType,
              identifier: pending.expectedIdentifier,
              projectId
            });

            // Ajouter le template au projet
            try {
              await addTemplateToProject.mutateAsync({
                projectId,
                templateType: pending.templateType,
                templateId: pending.expectedIdentifier
              });

              if (onRecovery) {
                onRecovery(pending.expectedIdentifier, pending.templateType);
              }

              toast({
                title: "Template récupéré ✅",
                description: `Le ${pending.templateType} a été ajouté au projet après récupération.`,
              });
            } catch (addError) {
              appLogger.error('❌ Erreur lors de l\'ajout du template récupéré', {
                error: addError,
                templateType: pending.templateType,
                identifier: pending.expectedIdentifier
              });
            }
          }
        }
      } catch (error) {
        appLogger.warning('⚠️ Erreur lors de la vérification de récupération', {
          error: error instanceof Error ? error.message : String(error),
          pending
        });
      }
    }
  }, [pendingGenerations, projectId, sessionId, addTemplateToProject, onRecovery]);

  useEffect(() => {
    if (pendingGenerations.length > 0) {
      // Démarrer la vérification après un délai initial
      const timer = setTimeout(checkForRecoveredTemplates, 10000); // 10 secondes

      return () => clearTimeout(timer);
    }
  }, [pendingGenerations, checkForRecoveredTemplates]);

  // Ce composant est invisible, il ne fait que la logique de récupération
  return null;
};

export default TemplateRecoveryService;
