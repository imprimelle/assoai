
export interface ProductVariant {
  id: string;
  name: string;
  price: number;
  sku?: string; // Stock Keeping Unit (référence produit)
  attributes?: Record<string, string>; // ex: { "couleur": "rouge", "taille": "M" }
  image_url?: string | null; // URL de l'image de la variante
}

export interface ManufacturingRule {
  id: string;
  type: string; // ex: "découpe", "assemblage", "finition"
  description: string;
  timeRequired?: number; // temps en minutes
  materialRequired?: string;
  specialInstructions?: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  main_image_url: string | null;
  gallery_images: string[];
  variants: ProductVariant[];
  manufacturing_rules: ManufacturingRule[];
  created_at: string;
  updated_at: string;
  created_by?: string;
  session_id?: string;
}

export interface ProductFormData {
  name: string;
  description: string;
  main_image_url: string | null;
  gallery_images: string[];
  variants: ProductVariant[];
  manufacturing_rules: ManufacturingRule[];
}

// For client suggestions
export interface ClientSuggestion {
  nom: string;
  adresse: string;
  telephone?: string;
}

// For product suggestions
export interface ProductSuggestion {
  description: string;
  prixUnitaire: number;
  image_url?: string | null;
}
