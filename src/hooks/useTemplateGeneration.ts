
import { useState, useCallback } from 'react';
import { TemplateType } from '@/types';
import { WebhookRetryService } from '@/services/webhookRetryService';
import { appLogger } from '@/utils/logger';
import { toast } from '@/hooks/use-toast';

interface GenerationState {
  isActive: boolean;
  elapsedMinutes: number;
  generationId: string | null;
  error: string | null;
}

export const useTemplateGeneration = () => {
  const [generationState, setGenerationState] = useState<GenerationState>({
    isActive: false,
    elapsedMinutes: 0,
    generationId: null,
    error: null
  });

  const startGeneration = useCallback(async (
    payload: any,
    generationId: string,
    contextInfo?: string
  ) => {
    if (generationState.isActive) {
      toast({
        title: "Génération en cours",
        description: "Une génération est déjà en cours. Veuillez patienter.",
        variant: "destructive"
      });
      return null;
    }

    setGenerationState({
      isActive: true,
      elapsedMinutes: 0,
      generationId,
      error: null
    });

    appLogger.info('🚀 Début de génération avec attente persistante', {
      generationId,
      contextInfo
    });

    try {
      const result = await WebhookRetryService.sendWithPersistentWait(payload, {
        showProgressToast: true,
        contextInfo,
        generationId,
        onProgress: (elapsedMinutes) => {
          setGenerationState(prev => ({
            ...prev,
            elapsedMinutes
          }));
        }
      });

      setGenerationState({
        isActive: false,
        elapsedMinutes: 0,
        generationId: null,
        error: null
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      
      setGenerationState({
        isActive: false,
        elapsedMinutes: 0,
        generationId: null,
        error: errorMessage
      });

      appLogger.error('❌ Échec de génération', {
        generationId,
        error: errorMessage
      });

      throw error;
    }
  }, [generationState.isActive]);

  const cancelGeneration = useCallback(() => {
    if (generationState.generationId) {
      WebhookRetryService.cancelGeneration(generationState.generationId);
    }
    
    setGenerationState({
      isActive: false,
      elapsedMinutes: 0,
      generationId: null,
      error: null
    });
  }, [generationState.generationId]);

  const canStartGeneration = useCallback((targetGenerationId: string) => {
    return !generationState.isActive || generationState.generationId !== targetGenerationId;
  }, [generationState.isActive, generationState.generationId]);

  return {
    generationState,
    startGeneration,
    cancelGeneration,
    canStartGeneration
  };
};
