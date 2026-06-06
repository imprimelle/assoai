
import {
  PostgrestResponse,
  User,
} from "@supabase/supabase-js";
import {
  DBMessage,
  MessageAttachment,
} from "@/types/database";
import { Message, TemplateType } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { dbMessageToUiMessage, uiMessageToDbMessage } from "@/utils/conversion";
import { appLogger } from "@/utils/logger";
import { saveTemplateAndSync } from "./templateSaveWithVersioning";

/**
 * Sauvegarde un message dans la base de données
 * Standardisé pour utiliser exclusivement le format avec wrapper 'data'
 */
export const saveMessage = async (message: Message): Promise<string | null> => {
  try {
    appLogger.info('💾 Saving message', { 
      messageId: message.id,
      sessionId: message.sessionId,
      userId: message.userId,
      type: message.type,
      hasTemplate: !!message.template,
      templateType: message.template?.templateType
    });
    
    // Si le message a un template, exécuter la fonction de synchronisation du template pour la journalisation et la validation
    if (message.template) {
      await saveTemplateAndSync(message, message.userId);
    }
    
    // Vérifier et traiter les pièces jointes pour s'assurer qu'elles sont correctement enregistrées
    if (message.attachments && message.attachments.length > 0) {
      appLogger.info('📎 Message contient des pièces jointes:', { 
        count: message.attachments.length,
        urls: message.attachments
      });
    }
    
    const dbMessage = uiMessageToDbMessage(message);
    
    appLogger.info('🔄 saveMessage - dbMessage préparé', {
      id: dbMessage.id,
      sender: dbMessage.sender,
      hasTemplateData: !!dbMessage.template_data,
      templateType: dbMessage.template_type,
      attachments: dbMessage.attachments
    });
    
    // Insérer le message - le déclencheur de base de données gérera automatiquement le versioning
    const { data, error } = await supabase.from("messages").insert(dbMessage).select("id").single();
    
    if (error) {
      appLogger.error('❌ Error saving message', { error, message });
      return null;
    }
    
    appLogger.info('✅ Message saved successfully', { 
      messageId: data.id,
      sessionId: message.sessionId 
    });
    
    // Après l'enregistrement, vérifier si le déclencheur a correctement mis à jour les anciennes versions si c'est un template
    if (message.template) {
      const { templateType, data: templateData } = message.template;
      
      // Déterminer la clé d'identifiant et la valeur
      let idKey: string = "";
      let idValue: string = "";
      
      switch (templateType) {
        case "facture":
          idKey = "factureNumero";
          idValue = (templateData as any).factureNumero;
          break;
        case "devis":
          idKey = "devisNumero";
          idValue = (templateData as any).devisNumero;
          break;
        case "commande":
          idKey = "commandeNumero";
          idValue = (templateData as any).commandeNumero;
          break;
        case "cahier_des_charges":
          idKey = "titre";
          idValue = (templateData as any).titre;
          break;
      }
      
      appLogger.info('📊 Clés d\'identification pour le template', {
        templateType,
        idKey,
        idValue
      });
      
      // Vérifier toutes les versions de ce template pour vérifier les drapeaux is_latest
      if (idKey && idValue) {
        // Syntaxe corrigée pour les filtres JSONB
        const { data: versions, error: versionsError } = await supabase
          .from("messages")
          .select("id, template_data")
          .eq("template_type", templateType)
          .filter(`template_data->data->>${idKey}`, "eq", idValue);
          
        if (versionsError) {
          appLogger.error("❌ Error checking versions after save", { versionsError });
        } else if (versions) {
          appLogger.info(`📊 Post-save version check for ${templateType}:${idValue}`, {
            versions: versions.map(v => ({
              id: v.id,
              version: v.template_data && typeof v.template_data === 'object' ? 
                ((v.template_data as any)?.data?.version) : undefined,
              is_latest: v.template_data && typeof v.template_data === 'object' ? 
                ((v.template_data as any)?.data?.is_latest) : undefined
            }))
          });
        }
      }
      // Après vérification, réparer les flags is_latest pour TOUS les
      // types (contourne le trigger DB défectueux qui met is_latest=false
      // sur tous les anciens messages sans filtrer ni par type ni par numéro)
      if (idKey) {
        // Réparer TOUS les types en parallèle et ATTENDRE la fin
        // (sinon l'UI affiche les données périmées du trigger)
        const ALL_TYPES = [
          { type: "facture", key: "factureNumero" },
          { type: "devis", key: "devisNumero" },
          { type: "commande", key: "commandeNumero" },
          { type: "cahier_des_charges", key: "titre" },
        ];
        await Promise.all(
          ALL_TYPES.map(t => repairIsLatestAfterSave(t.type, t.key))
        );
      }
    }

    return data.id;
  } catch (error) {
    appLogger.error('❌ Exception saving message', { error, message });
    return null;
  }
};

// ============================================================
// RÉPARATION is_latest (contourne le trigger DB défectueux)
// ============================================================

/**
 * Après chaque sauvegarde, répare les flags is_latest pour tous les
 * documents du même type. Le trigger DB met incorrectement is_latest=false
 * sur TOUS les anciens documents (quel que soit leur numéro). Cette fonction
 * restaure is_latest=true sur la dernière version de chaque numéro distinct.
 */
export async function repairIsLatestAfterSave(
  templateType: string,
  idKey: string
): Promise<void> {
  try {
    const { data: messages, error: fetchErr } = await supabase
      .from("messages")
      .select("id, template_data")
      .eq("template_type", templateType)
      .order("timestamp", { ascending: false })
      .limit(200);

    if (fetchErr || !messages) {
      appLogger.warning("repairIsLatest: fetch echoue", { error: fetchErr });
      return;
    }

    // Grouper par identifiant (numero) et trouver la version max
    const groups = new Map<string, { id: string; version: number }>();
    for (const msg of messages) {
      const td = (msg.template_data as any)?.data;
      if (!td) continue;
      const identifier = td[idKey];
      if (!identifier) continue;
      const version = typeof td.version === "number" ? td.version : 1;
      const existing = groups.get(identifier);
      if (!existing || version > existing.version) {
        groups.set(identifier, { id: msg.id, version });
      }
    }

    // Pour chaque identifiant, mettre is_latest=true sur le plus recent
    let fixed = 0;
    for (const [, { id: latestId }] of groups) {
      const msg = messages.find(m => m.id === latestId);
      if (!msg) continue;
      const td = (msg.template_data as any)?.data;
      if (!td || td.is_latest === true) continue;

      const updatedTd = { ...td, is_latest: true };
      const { error: updErr } = await supabase
        .from("messages")
        .update({ template_data: { data: updatedTd } })
        .eq("id", latestId);

      if (!updErr) fixed++;
    }

    if (fixed > 0) {
      appLogger.info(`repairIsLatest: ${fixed} documents ${templateType} corriges`, {
        total: messages.length,
        uniqueIdentifiers: groups.size,
        fixed,
      });
    }
  } catch (err) {
    appLogger.warning("repairIsLatest exception", { error: err });
  }
}

/**
 * Charge les messages d'une session spécifique
 * Standardisé pour utiliser exclusivement le format avec wrapper 'data'
 */
export const loadMessagesBySession = async (sessionId: string): Promise<Message[]> => {
  try {
    appLogger.info('Loading messages for session', { sessionId });
    
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("session_id", sessionId)
      .order("timestamp", { ascending: true });
    
    if (error) {
      appLogger.error('Error loading messages', { error, sessionId });
      return [];
    }
    
    if (!data || data.length === 0) {
      appLogger.info('No messages found for session', { sessionId });
      return [];
    }
    
    const messages = data.map(item => {
      const msg = dbMessageToUiMessage(item as unknown as DBMessage);
      
      // Log les attachements pour déboguer
      if (msg.attachments && msg.attachments.length > 0) {
        appLogger.info('Message avec attachements chargé:', { 
          messageId: msg.id, 
          attachments: msg.attachments 
        });
      }
      
      return msg;
    });
    
    appLogger.info('Messages loaded successfully', { 
      sessionId, 
      messageCount: messages.length,
      withAttachments: messages.filter(m => m.attachments && m.attachments.length > 0).length
    });
    
    return messages;
  } catch (error) {
    appLogger.error('Exception loading messages', { error, sessionId });
    return [];
  }
};

/**
 * Récupère tous les messages de la base de données (pour débogage)
 */
export const getAllMessages = async (): Promise<DBMessage[]> => {
  try {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .order("timestamp", { ascending: true });
    
    if (error) {
      console.error("Erreur lors de la récupération de tous les messages:", error);
      return [];
    }
    
    return data as unknown as DBMessage[];
  } catch (error) {
    console.error("Exception lors de la récupération de tous les messages:", error);
    return [];
  }
};

/**
 * Récupère le numéro de version de la dernière édition d'un template donné.
 * Standardisé pour toujours utiliser le format avec wrapper data
 * @param templateType  « facture », « devis », « commande » ou « cahier_des_charges »
 * @param idKey         Nom de la clé d'identifiant (e.g. "factureNumero", "titre", ...)
 * @param idValue       Valeur de l'identifiant (e.g. "FAC-2025-001")
 * @returns             Le numéro de version ou null en cas d'erreur
 */
export async function getLastTemplateVersion(
  templateType: string,
  idKey: string,
  idValue: string
): Promise<number | null> {
  // Syntaxe corrigée pour les filtres JSONB
  const { data, error } = await supabase
    .from("messages")
    .select("template_data")
    .eq("template_type", templateType)
    .filter(`template_data->data->>is_latest`, "eq", "true")
    .filter(`template_data->data->>${idKey}`, "eq", idValue)
    .single();

  if (error || !data) {
    console.error("getLastTemplateVersion error:", error);
    appLogger.error('getLastTemplateVersion error', { error, templateType });
    return null;
  }
  
  // We know the data is wrapped in a 'data' property
  return (data.template_data as any).data.version as number;
}
