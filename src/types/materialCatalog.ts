// src/types/materialCatalog.ts
// Entrée du catalogue des matières premières (table Supabase `materials`).

export const MATERIAL_CATEGORIES = [
  "Découpe",
  "Éclairage",
  "Outillage",
  "Métal",
  "Vinyl",
] as const;

export type MaterialCategorie = (typeof MATERIAL_CATEGORIES)[number];

export interface MaterialCatalogEntry {
  id: string;
  external_id: number | null;
  categorie: string;
  sous_type: string | null;
  materiau: string;
  epaisseur: string | null;
  format_standard: string | null;
  largeur_std: number | null;
  hauteur_std: number | null;
  cout_min: number | null;
  cout_max: number | null;
  cout_usinage: number | null;
  unite: string;
  couleurs: string[];
  image_url: string | null;
  // Champs spécifiques à certaines catégories (Éclairage / Outillage)
  puissance_volt?: string | null;
  etancheite?: string | null;
  indications?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type MaterialCatalogFormData = Omit<
  MaterialCatalogEntry,
  "id" | "created_at" | "updated_at"
>;

export const EMPTY_MATERIAL: MaterialCatalogFormData = {
  external_id: null,
  categorie: "Découpe",
  sous_type: null,
  materiau: "",
  epaisseur: null,
  format_standard: null,
  largeur_std: null,
  hauteur_std: null,
  cout_min: null,
  cout_max: null,
  cout_usinage: null,
  unite: "plaque",
  couleurs: [],
  image_url: null,
  puissance_volt: null,
  etancheite: null,
  indications: null,
};
