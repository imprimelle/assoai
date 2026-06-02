
import { MessagePayload, ResponsePayload } from "@/types";
import { sendMessageToWebhook } from "./webhook";
import { appLogger } from "@/utils/logger";
import { toast } from "@/hooks/use-toast";

export class WebhookRetryService {
  private static activeGenerations = new Map<string, boolean>();

  static async sendWithPersistentWait(
    payload: MessagePayload,
    options?: {
      showProgressToast?: boolean;
      contextInfo?: string;
      generationId?: string;
      onProgress?: (elapsedMinutes: number) => void;
    }
  ): Promise<ResponsePayload> {
    const { showProgressToast = true, contextInfo = "", generationId, onProgress } = options || {};
    const lockKey = generationId || `${payload.sessionId}-${Date.now()}`;

    // Vérifier si une génération est déjà en cours pour cette clé
    if (this.activeGenerations.has(lockKey)) {
      throw new Error("Une génération est déjà en cours pour ce template");
    }

    // Verrouiller cette génération
    this.activeGenerations.set(lockKey, true);

    if (showProgressToast) {
      toast({
        title: "Génération en cours",
        description: `Traitement de votre demande${contextInfo ? ` (${contextInfo})` : ''}...`,
        duration: 5000
      });
    }

    const startTime = Date.now();
    const maxWaitTime = 30 * 60 * 1000; // 30 minutes pour projets
    let lastNetworkError: Error | null = null;

    try {
      // Système de polling pour vérifier le template en base pendant l'attente
      const checkTemplateExists = async (): Promise<ResponsePayload | null> => {
        if (!payload.message.template) return null;
        
        const { templateType, data } = payload.message.template;
        let identifier = "";
        
        switch (templateType) {
          case "facture":
            identifier = (data as any).factureNumero;
            break;
          case "devis":
            identifier = (data as any).devisNumero;
            break;
          case "commande":
            identifier = (data as any).commandeNumero;
            break;
          case "cahier_des_charges":
            identifier = (data as any).titre;
            break;
        }

        if (!identifier) return null;

        try {
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
              return null;
          }

          const { data: templates } = await supabase
            .from("messages")
            .select("template_data")
            .eq("template_type", templateType)
            .filter(`template_data->data->>${idKey}`, "eq", identifier)
            .filter(`template_data->data->>is_latest`, "eq", "true")
            .order("timestamp", { ascending: false })
            .limit(1);

          if (templates && templates.length > 0) {
            // Vérifier que template_data.data existe avant d'y accéder
            const templateData = templates[0].template_data;
            if (templateData && typeof templateData === 'object' && templateData !== null && 'data' in templateData) {
              return {
                agentId: "database-recovery",
                sessionId: payload.sessionId,
                timestamp: new Date().toISOString(),
                response: {
                  mode: "template",
                  templateType,
                  data: (templateData as any).data
                }
              };
            }
          }
        } catch (error) {
          appLogger.warning("Erreur lors de la vérification du template en base", { error });
        }
        
        return null;
      };

      // Lancer la requête webhook avec gestion tolérante des erreurs réseau
      const webhookPromise = this.attemptWebhookWithNetworkTolerance(payload, startTime, maxWaitTime, onProgress);
      
      // Lancer le polling en parallèle - vérification plus fréquente (15 secondes)
      const pollingPromise = this.pollForTemplate(checkTemplateExists, maxWaitTime, startTime, 15000);

      // Attendre soit la réponse webhook soit la récupération par polling
      const result = await Promise.race([webhookPromise, pollingPromise]);
      
      return result;

    } finally {
      // Nettoyer le verrou
      this.activeGenerations.delete(lockKey);
    }
  }

  private static async attemptWebhookWithNetworkTolerance(
    payload: MessagePayload,
    startTime: number,
    maxWaitTime: number,
    onProgress?: (elapsedMinutes: number) => void
  ): Promise<ResponsePayload> {
    let lastNetworkError: Error | null = null;
    const progressInterval = setInterval(() => {
      const elapsedMinutes = Math.floor((Date.now() - startTime) / (60 * 1000));
      if (onProgress) onProgress(elapsedMinutes);
      
      if (elapsedMinutes >= 25) {
        toast({
          title: "Génération longue",
          description: "La génération prend plus de temps que prévu. Vous pouvez continuer dans le chat si nécessaire.",
          duration: 10000
        });
      }
    }, 60000); // Toutes les minutes

    try {
      // **UNE SEULE TENTATIVE** - pas de retry automatique
      appLogger.info('🚀 Début génération persistante - une seule tentative', {
        sessionId: payload.sessionId,
        timeout: `${maxWaitTime / 60000} minutes`,
        maxWaitTime
      });

      const response = await sendMessageToWebhook(payload);
      clearInterval(progressInterval);
      
      appLogger.info('✅ Génération réussie du premier coup', {
        sessionId: payload.sessionId,
        elapsedTime: `${(Date.now() - startTime) / 1000}s`
      });
      
      return response;
      
    } catch (error: any) {
      clearInterval(progressInterval);
      lastNetworkError = error;
      
      appLogger.warning('⚠️ Erreur lors de la génération webhook', {
        error: error.message,
        isNetwork: error.isNetwork,
        isTimeout: error.isTimeout,
        elapsedTime: `${(Date.now() - startTime) / 1000}s`,
        sessionId: payload.sessionId
      });
      
      // Au lieu de faire échouer immédiatement, attendre le polling
      throw new Error(`Webhook échoué mais attente persistante active: ${error.message}`);
    }
  }

  private static async pollForTemplate(
    checkFunction: () => Promise<ResponsePayload | null>,
    maxWaitTime: number,
    startTime: number,
    pollingInterval: number = 15000 // 15 secondes par défaut
  ): Promise<ResponsePayload> {
    appLogger.info('🔍 Démarrage polling pour récupération template', {
      pollingInterval: `${pollingInterval / 1000}s`,
      maxWaitTime: `${maxWaitTime / 60000} minutes`
    });

    while ((Date.now() - startTime) < maxWaitTime) {
      const result = await checkFunction();
      if (result) {
        appLogger.info('✅ Template récupéré par polling!', {
          elapsedTime: `${(Date.now() - startTime) / 1000}s`
        });
        
        toast({
          title: "Template récupéré ✅",
          description: "Le template a été généré avec succès et récupéré automatiquement!",
        });
        
        return result;
      }
      
      // Attendre avant la prochaine vérification
      await new Promise(resolve => setTimeout(resolve, pollingInterval));
    }
    
    throw new Error(`Template non trouvé après ${maxWaitTime / 60000} minutes d'attente persistante`);
  }

  static async sendWithFallback(
    payload: MessagePayload,
    onFallback?: () => Promise<void>,
    options?: {
      showProgressToast?: boolean;
      contextInfo?: string;
      generationId?: string;
      onProgress?: (elapsedMinutes: number) => void;
    }
  ): Promise<ResponsePayload | null> {
    try {
      return await this.sendWithPersistentWait(payload, options);
    } catch (error) {
      appLogger.error("❌ Génération définitivement échouée après attente persistante", {
        error: error instanceof Error ? error.message : String(error),
        sessionId: payload.sessionId,
        contextInfo: options?.contextInfo
      });

      if (onFallback) {
        await onFallback();
      }

      return null;
    }
  }

  static isGenerationActive(generationId: string): boolean {
    return this.activeGenerations.has(generationId);
  }

  static cancelGeneration(generationId: string): void {
    this.activeGenerations.delete(generationId);
    appLogger.info('🚫 Génération annulée', { generationId });
  }
}
