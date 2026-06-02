
import { DBMessage, MessageAttachment, Json } from "@/types/database";
import { Message, MessageType, TemplateType, TemplateData } from "@/types";
import { appLogger } from "@/utils/logger";

/**
 * Convertit un message de la base de données en un message pour l'UI
 * Maintenant standardisé pour toujours extraire les données du wrapper 'data'
 */
export const dbMessageToUiMessage = (dbMessage: DBMessage): Message => {
  appLogger.info("🔄 dbMessageToUiMessage - Input DBMessage:", JSON.stringify(dbMessage, null, 2).substring(0, 500) + "...");
  
  // Déterminer le type de message pour l'UI
  let messageType: MessageType = "text";
  if (dbMessage.attachments && dbMessage.attachments.length > 0) {
    const firstAttachment = dbMessage.attachments[0];
    if (firstAttachment.type.startsWith("image/")) {
      messageType = "image";
    } else if (firstAttachment.type.startsWith("audio/")) {
      messageType = "audio";
    } else if (firstAttachment.type.startsWith("video/")) {
      messageType = "video";
    } else {
      messageType = "document";
    }
  }

  // Créer le message UI
  const uiMessage: Message = {
    id: dbMessage.id,
    sessionId: dbMessage.session_id?.trim(),
    userId: dbMessage.user_id?.trim(),
    content: dbMessage.content || "",
    timestamp: dbMessage.timestamp,
    type: messageType,
    attachments: dbMessage.attachments.map(att => att.url),
    isUser: dbMessage.sender === 'user'
  };

  // Ajouter les données de template si présentes - Standardisé pour toujours utiliser le format data wrapper
  if (dbMessage.template_type && dbMessage.template_data) {
    appLogger.info("🔍 Template data trouvé dans DBMessage: " + 
      dbMessage.template_type + " " + JSON.stringify(dbMessage.template_data).substring(0, 500) + "...");
    
    // Vérifier la structure du template_data et utiliser le wrapper data
    const templateData = dbMessage.template_data as any;
    
    if (templateData && typeof templateData === 'object') {
      if (templateData.data) {
        // Si le wrapper data est présent, utiliser directement les données
        appLogger.info("📋 Template data structure: utilisation du wrapper data existant", {
          version: templateData.data.version,
          is_latest: templateData.data.is_latest
        });
        
        uiMessage.template = {
          templateType: dbMessage.template_type as TemplateType,
          data: templateData.data as TemplateData
        };
      } else {
        appLogger.warning("⚠️ Template data sans wrapper trouvé, ce qui ne devrait plus arriver après la migration");
        
        // Créer une structure compatible pour éviter les erreurs
        uiMessage.template = {
          templateType: dbMessage.template_type as TemplateType,
          data: templateData as TemplateData
        };
      }
      
      // Log pour le débogage
      appLogger.info("🔖 Informations de versioning du template", {
        version: uiMessage.template.data?.version,
        is_latest: uiMessage.template.data?.is_latest
      });
    }
    
    if (dbMessage.quote) {
      uiMessage.quote = {
        ...dbMessage.quote,
        montant: dbMessage.quote.montant
      };
    }
  } else if (dbMessage.template_type && dbMessage.quote) {
    uiMessage.template = {
      templateType: dbMessage.template_type as TemplateType,
      data: {} as TemplateData
    };
    uiMessage.quote = {
      ...dbMessage.quote,
      montant: dbMessage.quote.montant
    };
  }

  appLogger.info("🔄 dbMessageToUiMessage - Output Message: " +  
    JSON.stringify({
      id: uiMessage.id,
      content: uiMessage.content,
      type: uiMessage.type,
      hasTemplate: !!uiMessage.template,
      templateType: uiMessage.template?.templateType,
      version: uiMessage.template?.data?.version,
      is_latest: uiMessage.template?.data?.is_latest
    }));

  return uiMessage;
};

/**
 * Prépare un message UI pour l'enregistrement dans la base de données
 * Standardisé pour toujours utiliser le format avec wrapper 'data'
 */
export const uiMessageToDbMessage = (message: Message): Omit<DBMessage, "timestamp"> => {
  appLogger.info("🔄 uiMessageToDbMessage - Input Message: " + 
    JSON.stringify({
      content: message.content,
      type: message.type,
      hasTemplate: !!message.template,
      templateType: message.template?.templateType,
      version: message.template?.data?.version,
      is_latest: message.template?.data?.is_latest
    }));

  // Mappage des pièces jointes
  const attachments: MessageAttachment[] = message.attachments.map(url => ({
    type: guessAttachmentType(url),
    url: url,
    name: url.split('/').pop() || ""
  }));

  // Quote est cohérent en tant que string dans les interfaces UI et DB
  const quote = message.quote ? {
    ...message.quote,
    montant: message.quote.montant
  } : null;

  // Utiliser systématiquement la structure standardisée avec wrapper data pour les données de template
  let templateData = null;
  if (message.template?.data) {
    // Créer une copie propre des données
    const data = JSON.parse(JSON.stringify(message.template.data));
    
    // S'assurer que la propriété details existe et est un tableau dans FactureData
    if (message.template.templateType === 'facture' && !data.details) {
      data.details = [];
    }
    
    // Toujours utiliser le wrapper data pour une structure de base de données cohérente
    templateData = { data };
    
    appLogger.info("💾 Enregistrement des données de template avec structure standardisée", {
      templateType: message.template.templateType,
      version: data.version,
      is_latest: data.is_latest
    });
  }

  // Créer le message pour la base de données
  const dbMessage: Omit<DBMessage, "timestamp"> = {
    id: message.id,                        
    session_id: message.sessionId?.trim(),
    user_id: message.userId?.trim(),
    sender: message.isUser ? 'user' : 'ai',
    content: message.content,
    attachments: attachments,
    template_type: message.template?.templateType || null,
    template_data: templateData as Json,
    quote: quote,
    version_ref: null
  };

  if (message.template) {
    appLogger.info("🔍 Template data à sauvegarder: " + 
      message.template.templateType + " " +
      JSON.stringify(templateData).substring(0, 500) + "...");
  }

  return dbMessage;
};

/**
 * Détermine le type MIME approximatif d'une pièce jointe à partir de son URL
 */
const guessAttachmentType = (url: string): string => {
  const extension = url.split('.').pop()?.toLowerCase();
  if (!extension) return "application/octet-stream";

  switch (extension) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'mp3':
      return 'audio/mpeg';
    case 'wav':
      return 'audio/wav';
    case 'mp4':
      return 'video/mp4';
    case 'pdf':
      return 'application/pdf';
    case 'doc':
    case 'docx':
      return 'application/msword';
    default:
      return 'application/octet-stream';
  }
};
