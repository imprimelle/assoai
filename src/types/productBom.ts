// ============================================================================
// PHASE 1 — Types TypeScript pour product_bom
// Fichier : src/types/productBom.ts
// ============================================================================

export const BOM_SECTIONS = [
  "Découpe",
  "Éclairage",
  "Outillage",
  "Métal",
  "Vinyl",
] as const;

export type BomSection = (typeof BOM_SECTIONS)[number];

/** Une ligne de nomenclature produit. */
export interface ProductBomItem {
  id: string;
  product_id: string;
  variant_id?: string | null;
  section: BomSection;
  material_id?: string | null;
  material_name: string;
  formule?: string | null;
  quantite_fixe?: number | null;
  unite: string;
  reference?: string;
  ordre: number;
  condition_expr?: string | null;
  profile_group?: string | null;
  profile_value?: string | null;
  meta_variables?: Record<string, any> | null;
  created_at?: string;
  updated_at?: string;
}

/** Payload pour création/mise à jour (sans id, product_id, timestamps). */
export interface ProductBomFormItem {
  section: BomSection;
  material_id?: string | null;
  material_name: string;
  formule?: string | null;
  quantite_fixe?: number | null;
  unite: string;
  reference?: string;
  ordre: number;
  condition_expr?: string | null;
  profile_group?: string | null;
  profile_value?: string | null;
  meta_variables?: Record<string, any> | null;
}

/** Résultat d'un match avec le catalogue matériaux. */
export interface BomMaterialMatch {
  material: MaterialCatalogEntry | null;
  matched: boolean;
  reason?: string;  // "catalogue", "libre", "introuvable"
}
