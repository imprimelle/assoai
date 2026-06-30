import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface DeriveResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Hook pour dériver un document sans passer par le chat.
 * Appelle directement l'API Hermes avec le template source COMPLET.
 *
 * Si `sourceMessageId` est fourni, le hook fetch la template_data complète
 * depuis Supabase avant d'appeler l'API. Sinon il utilise attachedTemplate tel quel.
 */
export const useDeriveDocument = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<DeriveResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const derive = async (
    message: string,
    profile: 'hermes-wari' | 'hermes-brico',
    skills: string[],
    attachedTemplate: { templateType: string; data: any },
    projectId?: string,
    sourceMessageId?: string
  ): Promise<DeriveResult> => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    // Si un sourceMessageId est fourni, fetch le document COMPLET depuis Supabase
    let templateToSend = attachedTemplate;
    if (sourceMessageId) {
      try {
        const { data: msg } = await supabase
          .from('messages')
          .select('template_type, template_data')
          .eq('id', sourceMessageId)
          .single();
        if (msg) {
          const fullData = (msg.template_data as any)?.data;
          if (fullData) {
            templateToSend = {
              templateType: msg.template_type || attachedTemplate.templateType,
              data: fullData,
            };
          }
        }
      } catch (e) {
        // Fallback : utiliser le template partiel
        console.warn('[useDeriveDocument] Impossible de fetch le document complet, fallback partiel');
      }
    }

    try {
      const response = await fetch('/hermes/router', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          userId: 'system',
          sessionId: projectId ? `derive-${projectId}-${Date.now()}` : `derive-${Date.now()}`,
          profile,
          skills,
          attachedTemplate: templateToSend,
          projectId: projectId || undefined,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Échec de la dérivation');
        setIsLoading(false);
        return { success: false, error: data.error };
      }

      const result: DeriveResult = { success: true, data: data.response?.data };
      setResult(result);
      setIsLoading(false);
      return result;
    } catch (err: any) {
      setError(err.message || 'Erreur réseau');
      setIsLoading(false);
      return { success: false, error: err.message };
    }
  };

  const reset = () => {
    setIsLoading(false);
    setResult(null);
    setError(null);
  };

  return { derive, isLoading, result, error, reset };
};
