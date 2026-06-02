
import { appLogger } from "@/utils/logger";
import { toast } from "@/hooks/use-toast";

interface RetryOptions {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  exponentialBase: number;
  timeoutMs?: number;
}

interface RetryState {
  attempt: number;
  lastError?: Error;
  startTime: number;
}

// Configuration pour génération persistante - une seule tentative
const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 1, // UNE SEULE tentative pour éviter requêtes multiples
  baseDelay: 1000,
  maxDelay: 30000,
  exponentialBase: 2,
  timeoutMs: undefined // Pas de timeout par défaut, laissé au service appelant
};

export class RetryService {
  private static calculateDelay(attempt: number, options: RetryOptions): number {
    const delay = options.baseDelay * Math.pow(options.exponentialBase, attempt - 1);
    return Math.min(delay, options.maxDelay);
  }

  static async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {},
    onRetry?: (state: RetryState) => void
  ): Promise<T> {
    const finalOptions = { ...DEFAULT_RETRY_OPTIONS, ...options };
    const startTime = Date.now();
    
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= finalOptions.maxAttempts; attempt++) {
      try {
        appLogger.info(`🔄 RetryService - Tentative ${attempt}/${finalOptions.maxAttempts}`, {
          attempt,
          maxAttempts: finalOptions.maxAttempts,
          elapsedTime: `${(Date.now() - startTime) / 1000}s`
        });

        // Vérifier le timeout global seulement si spécifié
        if (finalOptions.timeoutMs && (Date.now() - startTime) > finalOptions.timeoutMs) {
          throw new Error(`Timeout global dépassé (${finalOptions.timeoutMs}ms)`);
        }

        const result = await operation();
        
        if (attempt > 1) {
          appLogger.info(`✅ RetryService - Succès après ${attempt} tentatives`, {
            totalAttempts: attempt,
            elapsedTime: `${(Date.now() - startTime) / 1000}s`
          });
        }

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        appLogger.warning(`⚠️ RetryService - Échec tentative ${attempt}`, {
          attempt,
          error: lastError.message,
          willRetry: attempt < finalOptions.maxAttempts,
          elapsedTime: `${(Date.now() - startTime) / 1000}s`
        });

        // Si c'est la dernière tentative, on lance l'erreur
        if (attempt === finalOptions.maxAttempts) {
          appLogger.error(`❌ RetryService - Échec final après ${attempt} tentatives`, {
            totalAttempts: attempt,
            finalError: lastError.message,
            elapsedTime: `${(Date.now() - startTime) / 1000}s`
          });
          throw lastError;
        }

        // Callback pour informer l'appelant de la retry
        if (onRetry) {
          onRetry({
            attempt,
            lastError,
            startTime
          });
        }

        // Attendre avant la prochaine tentative seulement si on a plusieurs tentatives
        if (finalOptions.maxAttempts > 1) {
          const delay = this.calculateDelay(attempt, finalOptions);
          appLogger.info(`⏳ RetryService - Attente ${delay}ms avant retry`, { delay, nextAttempt: attempt + 1 });
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // Cette ligne ne devrait jamais être atteinte
    throw lastError || new Error("Erreur inconnue dans RetryService");
  }

  static async checkTemplateExists(
    templateType: string, 
    identifier: string,
    maxWaitTime: number = 120000 // 2 minutes par défaut
  ): Promise<boolean> {
    const startTime = Date.now();
    const checkInterval = 15000; // 15 secondes - plus fréquent pour être plus réactif

    appLogger.info('🔍 Début vérification existence template', {
      templateType,
      identifier,
      maxWaitTime: `${maxWaitTime / 1000}s`,
      checkInterval: `${checkInterval / 1000}s`
    });

    while ((Date.now() - startTime) < maxWaitTime) {
      try {
        // Import dynamique pour éviter les dépendances circulaires
        const { supabase } = await import("@/integrations/supabase/client");
        
        let idKey: string;
        switch (templateType) {
          case "facture":
            idKey = "factureNumero";
            break;
          case "devis":
            idKey = "devisNumero";
            break;
          case "commande":
            idKey = "commandeNumero";
            break;
          case "cahier_des_charges":
            idKey = "titre";
            break;
          default:
            appLogger.warning('Type de template non supporté', { templateType });
            return false;
        }

        const { data, error } = await supabase
          .from("messages")
          .select("id")
          .eq("template_type", templateType)
          .filter(`template_data->data->>${idKey}`, "eq", identifier)
          .filter(`template_data->data->>is_latest`, "eq", "true")
          .limit(1);

        if (error) {
          appLogger.warning("Erreur lors de la vérification d'existence", { 
            error: error.message, 
            templateType, 
            identifier,
            elapsedTime: `${(Date.now() - startTime) / 1000}s`
          });
          await new Promise(resolve => setTimeout(resolve, checkInterval));
          continue;
        }

        if (data && data.length > 0) {
          appLogger.info(`✅ Template trouvé après vérification`, {
            templateType,
            identifier,
            elapsedTime: `${(Date.now() - startTime) / 1000}s`
          });
          return true;
        }

        // Log périodique pour suivre la progression
        const elapsedSeconds = (Date.now() - startTime) / 1000;
        if (elapsedSeconds % 60 === 0) { // Log toutes les minutes
          appLogger.info('🔍 Vérification en cours...', {
            templateType,
            identifier,
            elapsedTime: `${elapsedSeconds}s`,
            remainingTime: `${(maxWaitTime - (Date.now() - startTime)) / 1000}s`
          });
        }

        await new Promise(resolve => setTimeout(resolve, checkInterval));
      } catch (error) {
        appLogger.warning("Exception lors de la vérification d'existence", { 
          error: error instanceof Error ? error.message : String(error), 
          templateType, 
          identifier,
          elapsedTime: `${(Date.now() - startTime) / 1000}s`
        });
        await new Promise(resolve => setTimeout(resolve, checkInterval));
      }
    }

    appLogger.warning('❌ Template non trouvé après timeout', {
      templateType,
      identifier,
      totalWaitTime: `${maxWaitTime / 1000}s`
    });

    return false;
  }
}
