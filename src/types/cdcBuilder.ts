// src/types/cdcBuilder.ts
// Types pour le CDC Builder — utilise exclusivement les types canoniques existants.
// ZÉRO nouveau type pour les lignes — on réutilise MaterialItem + FlatMaterialRow.

import type { MaterialItem, TeamMember, DeliveryAddress } from "./material";

export interface CdcBuilderEnseigne {
  id: string;
  nom: string;
  dimensions: {
    largeur: number;
    hauteur: number;
    profondeur?: number;
  };
  image_url?: string;
  technique: {
    type_structure: string;
    method_fabrication: string;
  };
  produits: { id: string; nom: string; image_url?: string }[];
}

export interface CdcBuilderState {
  projectName: string;
  cdcNumero: string;
  commandeId: string;
  statut: string;
  enseignes: CdcBuilderEnseigne[];
  materiauxByEnseigne: Record<string, Record<string, MaterialItem[]>>;
  equipe: TeamMember[];
  deliveryAddress?: DeliveryAddress;
  /** ID du message Supabase si le CDC a déjà été sauvegardé */
  savedMessageId?: string;
}

/** Map clé `section-index`→ type de highlight pour animation flash (Brico) */
export type HighlightMap = Record<string, "added" | "modified">;

export interface CdcBuilderFooterMessage {
  role: "user" | "brico";
  text: string;
}

export interface BricoAction {
  type: "add" | "update" | "delete" | "group";
  section: string;
  enseigneIndex?: number;  // requis pour add/delete/group
  index?: number;
  item?: MaterialItem;
  changes?: Partial<MaterialItem>;
  /** 🆕 Action de groupe : fusionne N plaques en une feuille */
  groupe?: {
    material_id: string;       // FK → materials.id de la feuille
    nom: string;               // nom du matériau feuille
    format?: string;           // format feuille
    largeur_feuille: number;   // dimension feuille en mètres
    hauteur_feuille: number;   // dimension feuille en mètres
    enfants: MaterialItem[];   // les plaques à inclure
    // chute calculée automatiquement par le frontend
  };
  /** Indices des lignes à grouper (pour action type "group") */
  indices?: number[];
}

/** Réponse structurée retournée par le backend après parsing des actions CDC */
export interface CdcResponsePayload {
  textFallback: string;
  cdcActions?: BricoAction[];
}

/** Crée une enseigne vide avec un ID unique */
export function createEmptyEnseigne(): CdcBuilderEnseigne {
  return {
    id: crypto.randomUUID?.() || `ens-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    nom: "Nouvelle enseigne",
    dimensions: { largeur: 200, hauteur: 100 },
    technique: { type_structure: "", method_fabrication: "" },
    produits: [],
  };
}
