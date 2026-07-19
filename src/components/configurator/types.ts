// src/components/configurator/types.ts
// Interface commune à tous les renderers de produit.

/** Dimensions physiques de l'enseigne — toujours L × H, options selon le produit. */
export interface ProductDimensions {
  L: number;    // largeur (mètres)
  H: number;    // hauteur (mètres)
  P?: number;   // profondeur (optionnelle)
  d?: number;   // diamètre (optionnel, produits ronds)
}

/** Options spécifiques au produit, transmises telles quelles au renderer. */
export interface ProductOptions {
  [key: string]: any;
}

/** Interface que tous les renderers doivent implémenter. */
export interface ProductRendererProps {
  dimensions: ProductDimensions;
  options: ProductOptions;
  onPartClick?: (part: string, screenX: number, screenY: number) => void;
}

/** Famille géométrique d'un produit — détermine le renderer utilisé. */
export type ProductFamily = "A" | "B" | "C" | "D" | "E" | "F";

/** Mapping famille → description. */
export const FAMILY_LABELS: Record<ProductFamily, string> = {
  A: "Rectangle plan",
  B: "Disque / Cercle",
  C: "Volume / Totem",
  D: "Néon",
  E: "Miroir Infini",
  F: "Sur-mesure / Composite",
};

/** Détecte la famille d'un produit à partir de son nom et ses règles. */
export function detectFamily(productName: string, rulesDescription?: string): ProductFamily {
  const name = productName.toLowerCase();
  const rules = (rulesDescription || "").toLowerCase();

  if (name.includes("miroir") && (name.includes("infini") || name.includes("lumineux personnalisé"))) return "E";
  if (name.includes("rond") || name.includes("cercle") || name.includes("logo")) return "B";
  if (name.includes("totem") || (name.includes("3d") && !name.includes("plaque"))) return "C";
  if (name.includes("néon") || name.includes("neon")) return "D";
  if (name.includes("table") || name.includes("cacao") || name.includes("remix")) return "F";
  if (name.includes("revêtement") || name.includes("revetement")) return "A";
  return "A"; // défaut : rectangle plan
}
