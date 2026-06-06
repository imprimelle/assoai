
import type { MaterialItem, TeamMember, DeliveryAddress } from "./material";
import type { CahierStatus } from "./index";

export interface PromptGuidelines {
  title: string;
  description: string;
  examples: string[];
}

// -- Detail Items & Forms --
export interface DetailItem {
  id: string;
  description: string;
  quantite: number;
  prixUnitaire: number;
  sous_total: number;
}

export interface DetailItemFormProps {
  id: string;
  description: string;
  quantite: number;
  prix: number;
  sousTotal: number;
  image_url?: string;
  onDelete: () => void;
  onChange: (changes: any) => void;
  isEditable: boolean;
  disableAmountEdit?: boolean;
}

// -- Produit référence pour les enseignes (sans prix) --
export interface ProductReference {
  id: string;
  nom: string;
  description?: string;
  image_url?: string;
}

// -- Enseigne avec ses détails spécifiques --
export interface Enseigne {
  id: string;
  nom: string;
  produits: ProductReference[];
  // Détails spécifiques à chaque enseigne
  details: {
    image_url?: string;
    dimensions: {
      largeur: number;
      hauteur: number;
      profondeur?: number;
    };
    technique: {
      type_structure: string;
      method_fabrication: string;
    };
  };
  materiauxSections?: Record<string, MaterialItem[]>;
}

// -- Facture --
export interface FactureData {
  factureNumero: string;
  dateEmission: string;
  statut?: "Brouillon" | "infographie" | "demande" | "Payé" | "Livré";
  client: {
    nom: string;
    adresse: string;
    telephone?: string;
  };
  details: DetailItem[];
  total: number;
  version: number;
  is_latest: boolean;
  contact?: string;
  delaiLivraison?: string;
  echeancier?: string;
  reduction?: number;
  deliveryAddress?: DeliveryAddress;
}

// -- Devis --
export interface DevisData {
  devisNumero: string;
  dateEmission: string;
  validiteJours: number;
  client: {
    nom: string;
    adresse: string;
    telephone?: string;
  };
  details: DetailItem[];
  total: number;
  version: number;
  is_latest: boolean;
  statut?: "Brouillon" | "En attente" | "Accepté" | "Refusé" | "Expiré";
  deliveryAddress?: DeliveryAddress;
  cdc_id?: string;
  type_structure?: string;
  method_fabrication?: string;
}

// -- Commande --
export interface CommandeItem {
  id: string;
  nom: string;
  quantite: number;
  prixUnitaire: number;
  sous_total: number;
  image_url?: string;
}

export interface CommandeDetail {
  note?: string;
  option?: string;
  delaiLivraison?: string;
  montantAvance?: number;
}

export interface CommandeData {
  commandeNumero: string;
  dateCommande?: string;
  dateEmission?: string;
  dateLivraison?: string;
  client: {
    nom: string;
    adresse: string;
    telephone?: string;
  };
  items: CommandeItem[];
  details?: CommandeDetail[];
  total: number;
  statut: string;
  version: number;
  is_latest: boolean;
  linked_facture_id?: string | null;
  recu_image_url?: string | null;
  deliveryAddress?: DeliveryAddress;
}

export interface CahierDesChargesData {
  titre: string;
  cdcNumero?: string;
  commande_id?: string;
  statut?: CahierStatus;
  
  // Nouvelles données multi-enseignes
  enseignes: Enseigne[];
  
  // Données communes à toutes les enseignes
  equipe: TeamMember[];
  version: number;
  is_latest: boolean;
  deliveryAddress?: DeliveryAddress;
  
  // Données legacy pour rétrocompatibilité
  materiauxSections?: Record<string, MaterialItem[]>;
  dimensions?: {
    largeur: number;
    hauteur: number;
    profondeur?: number;
  };
  technique?: {
    type_structure: string;
    method_fabrication: string;
  };
  image_url?: string;
}

export type TemplateData =
  | FactureData
  | DevisData
  | CommandeData
  | CahierDesChargesData
  | Record<string, any>;
