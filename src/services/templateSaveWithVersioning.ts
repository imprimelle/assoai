
import { Message, TemplateType } from "@/types";
import { appLogger } from "@/utils/logger";
import { supabase } from "@/integrations/supabase/client";

/**
 * Prépare les données de template avant l'enregistrement dans la table messages
 * Cette fonction garantit que les données du template sont correctement structurées avant l'insertion
 * Elle journalise également les versions existantes à des fins de débogage
 * Standardisé pour utiliser exclusivement le format avec wrapper 'data'
 */
export const saveTemplateAndSync = async (message: Message, userId: string): Promise<void> => {
  try {
    if (!message.template) {
      appLogger.error("❌ saveTemplateAndSync: Aucun template fourni", { messageId: message.id });
      return;
    }

    const { templateType, data } = message.template;
    
    // Extraire l'identifiant clé pour le template
    let identifierKey: string | null = null;
    let identifierValue: string | null = null;
    
    // Obtenir le bon champ d'identifiant en fonction du type de template
    switch (templateType) {
      case "facture":
        identifierKey = "factureNumero";
        identifierValue = (data as any).factureNumero;
        break;
      case "devis":
        identifierKey = "devisNumero";
        identifierValue = (data as any).devisNumero;
        break;
      case "commande":
        identifierKey = "commandeNumero";
        identifierValue = (data as any).commandeNumero;
        break;
      case "cahier_des_charges":
        identifierKey = "cdcNumero";
        identifierValue = (data as any).cdcNumero || (data as any).titre;
        // Log détaillé pour le cahier des charges
        appLogger.info("🔍 Détails du cahier des charges", {
          titre: (data as any).titre,
          commande_id: (data as any).commande_id,
          data: JSON.stringify(data).substring(0, 200) + "..."
        });
        break;
      default:
        appLogger.warning("⚠️ Pas de support de versioning pour ce type de template", { templateType });
        return;
    }

    // Ignorer le versioning si aucun identifiant n'est trouvé
    if (!identifierValue) {
      appLogger.warning("⚠️ Aucun identifiant trouvé pour le versioning", { 
        templateType, 
        identifierKey,
        data: JSON.stringify(data).substring(0, 200) + "..." 
      });
      return;
    }

    // Pour le débogage - vérifier de manière cohérente les versions en utilisant le chemin template_data->data
    appLogger.info("🔎 Vérification des versions existantes pour le template", {
      templateType,
      identifier: `${identifierKey}:${identifierValue}`
    });
    
    // Interroger les templates existants avec le même identifiant pour voir les versions actuelles - utiliser le chemin standardisé
    const { data: existingVersions, error } = await supabase
      .from("messages")
      .select("id, template_data")
      .eq("template_type", templateType)
      .filter(`template_data->data->>${identifierKey}`, "eq", identifierValue);
      
    if (error) {
      appLogger.error("❌ Erreur lors de la vérification des versions existantes", { error });
    } else if (existingVersions) {
      appLogger.info(
        `📊 Trouvé ${existingVersions.length} versions existantes pour ${templateType}:${identifierValue}`, 
        {
          versions: existingVersions.map(v => ({
            id: v.id,
            version: v.template_data && typeof v.template_data === 'object'
              ? (v.template_data as any)?.data?.version 
              : undefined,
            is_latest: v.template_data && typeof v.template_data === 'object'
              ? (v.template_data as any)?.data?.is_latest 
              : undefined
          }))
        }
      );
    }
    
    appLogger.info("🔄 Le versioning du template sera géré par le déclencheur de base de données", {
      templateType,
      identifier: `${identifierKey}:${identifierValue}`,
      structureStandardisee: "Utilisation du wrapper data"
    });
  } catch (error) {
    appLogger.error("❌ Exception dans saveTemplateAndSync", { error, messageId: message.id });
  }
};

/**
 * Récupère tout l'historique des versions d'un template
 */
export const getTemplateVersionHistory = async (
  templateType: TemplateType,
  identifierKey: string,
  identifierValue: string
): Promise<any[]> => {
  try {
    const { data: versions, error } = await supabase
      .from("messages")
      .select("id, template_data, timestamp")
      .eq("template_type", templateType)
      .filter(`template_data->data->>${identifierKey}`, "eq", identifierValue)
      .order("timestamp", { ascending: false });
      
    if (error) {
      appLogger.error("❌ Erreur lors de la récupération de l'historique des versions du template", { 
        error, 
        templateType, 
        identifierKey,
        identifierValue 
      });
      return [];
    }
    
    return versions || [];
  } catch (error) {
    appLogger.error("❌ Exception dans getTemplateVersionHistory", { 
      error, 
      templateType, 
      identifierKey,
      identifierValue 
    });
    return [];
  }
};

/**
 * Récupération supplémentaire pour les cahiers des charges
 * Cette fonction permet de récupérer un cahier des charges via son commande_id
 */
export const getCahierDesChargesForCommandeId = async (commandeId: string): Promise<any[] | null> => {
  try {
    appLogger.info("🔍 Recherche du cahier des charges par commande_id", { commandeId });
    
    const { data, error } = await supabase
      .from("messages")
      .select("id, template_data, timestamp")
      .eq("template_type", "cahier_des_charges")
      .filter(`template_data->data->>commande_id`, "eq", commandeId)
      .eq(`template_data->data->>is_latest`, "true");
      
    if (error) {
      appLogger.error("❌ Erreur lors de la recherche du cahier des charges par commande_id", { 
        error, 
        commandeId 
      });
      return null;
    }
    
    appLogger.info(`📊 Trouvé ${data?.length || 0} cahiers des charges pour la commande ${commandeId}`);
    
    return data || [];
  } catch (error) {
    appLogger.error("❌ Exception dans getCahierDesChargesForCommandeId", { 
      error, 
      commandeId 
    });
    return null;
  }
};
