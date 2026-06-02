
import { Message, ResponsePayload, TemplateMetadata } from "@/types";
import { appLogger } from "@/utils/logger";

/**
 * Construit un payload de réponse local à partir d'un message contenant un template
 * Standardisé pour utiliser exclusivement le format avec wrapper 'data'
 */
export const buildLocalPayload = (msg: Message): ResponsePayload | null => {
  // Si le message n'a pas de template, on ne peut pas construire de payload
  if (!msg.template) return null;

  // S'assurer que les données de template sont valides
  if (!msg.template.data || typeof msg.template.data !== 'object') {
    appLogger.error("buildLocalPayload: invalid template data", msg.template);
    return null;
  }

  // Créer un metadata par défaut si non fourni
  const defaultMetadata: TemplateMetadata = {
    displayName: msg.template.templateType.charAt(0).toUpperCase() + msg.template.templateType.slice(1),
    description: "Template généré par l'IA",
    availableActions: ['save', 'download'],
    mode: 'editable',
    source: 'chatMessage'
  };

  // Log template versioning info
  appLogger.info("Template version info in buildLocalPayload", {
    templateType: msg.template.templateType,
    version: msg.template.data.version,
    is_latest: msg.template.data.is_latest
  });

  // Construire le payload avec les données du template
  return {
    agentId: msg.userId,
    sessionId: msg.sessionId,
    timestamp: msg.timestamp,
    response: {
      mode: "template",
      templateType: msg.template.templateType,
      textFallback: msg.content,
      data: msg.template.data,
      // Utiliser les métadonnées du template si disponibles, sinon utiliser les valeurs par défaut
      metadata: msg.template.metadata || defaultMetadata
    }
  };
};
