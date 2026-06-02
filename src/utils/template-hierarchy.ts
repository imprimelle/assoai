
import { TemplateType, TemplateData, FactureData, CommandeData, CahierDesChargesData, DevisData } from "@/types";
import { FileText, ShoppingCart, ClipboardList, FileCheck, Palette, UserPlus, Wrench, DollarSign, LucideIcon } from "lucide-react";
import { getTemplateIdentifier } from "./template-utils";

// Define the hierarchy relationships between templates
export type TemplateRelation = {
  sourceType: TemplateType;
  targetType: TemplateType;
  actionLabel: string;
  actionIcon: LucideIcon;
  buttonVariant: "orange" | "green" | "gray" | "purple" | "blue";
};

// Define which templates can be generated from each template type
export const templateHierarchy: TemplateRelation[] = [
  {
    sourceType: "facture",
    targetType: "commande",
    actionLabel: "Commander",
    actionIcon: ShoppingCart,
    buttonVariant: "green"
  },
  {
    sourceType: "commande",
    targetType: "cahier_des_charges",
    actionLabel: "Cahier des charges",
    actionIcon: ClipboardList,
    buttonVariant: "purple"
  },
  {
    sourceType: "cahier_des_charges",
    targetType: "devis",
    actionLabel: "Devis",
    actionIcon: FileCheck,
    buttonVariant: "blue"
  }
];

/**
 * Get the template relations that can be generated from a source template type
 */
export function getGeneratableRelations(sourceType: TemplateType): TemplateRelation[] {
  return templateHierarchy.filter(relation => relation.sourceType === sourceType);
}

/**
 * Get the relation between two template types if it exists
 */
export function getTemplateRelation(sourceType: TemplateType, targetType: TemplateType): TemplateRelation | undefined {
  return templateHierarchy.find(
    relation => relation.sourceType === sourceType && relation.targetType === targetType
  );
}

/**
 * Build a generation prompt message based on source and target template types
 */
export function buildGenerationPrompt(sourceType: TemplateType, targetType: TemplateType, sourceData: TemplateData): string {
  const basePrompt = `Génère ${getArticle(targetType)} ${getTemplateDisplayName(targetType).toLowerCase()} à partir de ${getArticle(sourceType)} ${getTemplateDisplayName(sourceType).toLowerCase()}`;
  
  // Add template-specific identifiers to the prompt
  if (sourceType === "facture" && targetType === "commande") {
    const factureData = sourceData as FactureData;
    return `${basePrompt} numéro ${factureData.factureNumero} pour ${factureData.client?.nom || "le client"}.`;
  } 
  else if (sourceType === "commande" && targetType === "cahier_des_charges") {
    const commandeData = sourceData as CommandeData;
    return `${basePrompt} numéro ${commandeData.commandeNumero} pour ${commandeData.client?.nom || "le client"}.`;
  } 
  else if (sourceType === "cahier_des_charges" && targetType === "devis") {
    const cahierData = sourceData as CahierDesChargesData;
    return `${basePrompt} pour le projet "${cahierData.titre}".`;
  }
  
  // Default prompt
  return `${basePrompt}.`;
}

/**
 * Get the appropriate French article ("un" or "une") for a template type
 */
function getArticle(templateType: TemplateType): string {
  switch (templateType) {
    case "facture": return "une";
    case "commande": return "une";
    case "devis": return "un";
    case "cahier_des_charges": return "un";
    default: return "un";
  }
}

/**
 * Get a display name for a template type
 */
export function getTemplateDisplayName(templateType: TemplateType): string {
  // Use a type guard to ensure templateType is a valid string
  if (typeof templateType !== 'string') {
    return "Document";
  }
  
  switch (templateType) {
    case "facture": return "Facture";
    case "devis": return "Devis";
    case "commande": return "Commande";
    case "cahier_des_charges": return "Cahier des charges";
    case "brief": return "Brief Graphique";
    case "contact": return "Contact";
    default: return String(templateType).charAt(0).toUpperCase() + String(templateType).slice(1);
  }
}

/**
 * Get icon for a template type
 */
export function getTemplateIcon(templateType: TemplateType): LucideIcon {
  switch (templateType) {
    case "facture": return DollarSign;
    case "devis": return FileText;
    case "commande": return ShoppingCart;
    case "cahier_des_charges": return Wrench;
    case "brief": return Palette;
    case "contact": return UserPlus;
    default: return FileText;
  }
}
