
import { 
  TemplateData, 
  TemplateType, 
  FactureData, 
  DevisData, 
  CommandeData, 
  CahierDesChargesData 
} from "@/types";
import { appLogger } from "./logger";

/**
 * Type guards to check the specific type of template data
 */
export function isFactureData(data: TemplateData): data is FactureData {
  return 'factureNumero' in data;
}

export function isDevisData(data: TemplateData): data is DevisData {
  return 'devisNumero' in data;
}

export function isCommandeData(data: TemplateData): data is CommandeData {
  return 'commandeNumero' in data;
}

/**
 * Enhanced type guard for cahier des charges - checks for multiple possible identifiers
 * Makes it more robust to handle different data formats
 */
export function isCahierDesChargesData(data: TemplateData): data is CahierDesChargesData {
  try {
    // First check for titre as the primary identifier
    if ('titre' in data) {
      return true;
    }
    
    // Secondary checks for when titre might be missing but we can still identify it
    if (
      ('equipe' in data && Array.isArray((data as any).equipe)) ||
      ('materiauxSections' in data) || 
      ('technique' in data && typeof (data as any).technique === 'object') ||
      ('dimensions' in data && typeof (data as any).dimensions === 'object')
    ) {
      return true;
    }
    
    // Logging for debug purposes when identification fails
    appLogger.info("isCahierDesChargesData - Identification échouée", {
      dataKeys: Object.keys(data),
      hasEquipe: 'equipe' in data,
      hasMateriauxSections: 'materiauxSections' in data,
      hasTechnique: 'technique' in data,
      hasDimensions: 'dimensions' in data 
    });
    
    return false;
  } catch (error) {
    // Protection contre les erreurs lors de la vérification
    appLogger.error("Erreur dans isCahierDesChargesData", {
      error,
      dataType: typeof data,
      isNull: data === null,
      isUndefined: data === undefined
    });
    return false;
  }
}

/**
 * Get the template identifier string based on template type and data
 */
export function getTemplateIdentifier(templateType: TemplateType, data: TemplateData): string {
  if (!data) {
    appLogger.warning("getTemplateIdentifier - données nulles", { templateType });
    return '';
  }
  
  try {
    switch (templateType) {
      case 'facture': 
        return isFactureData(data) ? data.factureNumero : '';
      case 'devis': 
        return isDevisData(data) ? data.devisNumero : '';
      case 'commande': 
        return isCommandeData(data) ? data.commandeNumero : '';
      case 'cahier_des_charges': 
        // Using enhanced type guard and checking for titre explicitly
        if (isCahierDesChargesData(data)) {
          return data.titre || 'Sans titre';
        }
        return '';
      default:
        return '';
    }
  } catch (error) {
    appLogger.error("Erreur dans getTemplateIdentifier", {
      error,
      templateType,
      dataType: typeof data
    });
    return '';
  }
}

/**
 * Normalize commandeId to ensure consistent format
 * This helps with matching commande_id between templates
 */
export function normalizeCommandeId(commandeId: string | null | undefined): string {
  if (!commandeId) return '';
  
  // Convert to string if not already
  const cmdId = String(commandeId).trim();
  
  // Remove common prefixes if present
  return cmdId.replace(/^(cmd|commande|command|#|n°|no\.)[-_\s]*/i, '');
}

/**
 * Helper function to determine if an error is likely a timeout
 */
export function isTimeoutError(error: any): boolean {
  if (!error) return false;
  
  // Vérifier si c'est une erreur d'abandon explicite
  if (error instanceof DOMException && error.name === 'AbortError') {
    return true;
  }
  
  // Vérifier si l'erreur contient un message lié à un timeout
  const errorMessage = (error.message || '').toLowerCase();
  const errorString = String(error).toLowerCase();
  
  return errorMessage.includes('timeout') || 
         errorMessage.includes('time out') || 
         errorMessage.includes('délai') ||
         errorMessage.includes('timed out') ||
         errorString.includes('timeout') ||
         // Cas spécifique pour les erreurs réseau
         errorMessage.includes('network') && errorMessage.includes('fail') ||
         errorMessage.includes('réseau') && errorMessage.includes('échec');
}
