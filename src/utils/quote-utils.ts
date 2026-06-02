
import {
  FactureData,
  DevisData,
  CommandeData,
  CahierDesChargesData,
} from "@/types/template-data";
import { TemplateType } from "@/types/template"; 

export interface QuoteData {
  type: "template";
  templateType: TemplateType;
  numero?: string;
  client?: string;
  montant?: string; // Always use string for UI consistency
  date?: string;
  title?: string;
  additionalText?: string;
}

export const buildQuoteData = (
  templateType: TemplateType,
  data: any
): QuoteData => {
  // Vérifier si data est un objet valide
  if (!data || typeof data !== 'object') {
    console.error(`buildQuoteData: données invalides pour le type ${templateType}`, data);
    return { type: "template", templateType };
  }

  switch (templateType) {
    case "facture": {
      const f = data as FactureData;
      return {
        type: "template",
        templateType,
        numero: f.factureNumero,
        client: f.client?.nom,
        montant: f.total !== undefined ? f.total.toString() : undefined,
        date: f.dateEmission,
        title: "Facture",
      };
    }
    case "devis": {
      const d = data as DevisData;
      return {
        type: "template",
        templateType,
        numero: d.devisNumero,
        client: d.client?.nom,
        montant: d.total !== undefined ? d.total.toString() : undefined,
        date: d.dateEmission,
        title: "Devis",
      };
    }
    case "commande": {
      const c = data as CommandeData;
      return {
        type: "template",
        templateType,
        numero: c.commandeNumero,
        client: c.client?.nom,
        montant: c.total !== undefined ? c.total.toString() : undefined,
        date: c.dateCommande,
        title: "Commande",
      };
    }
    case "cahier_des_charges": {
      const cd = data as CahierDesChargesData;
      return {
        type: "template",
        templateType,
        numero: cd.titre,
        title: "Cahier des charges",
      };
    }
    default:
      return { type: "template", templateType };
  }
};
