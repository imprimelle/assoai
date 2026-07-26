
export interface MaterialItem {
  id: string;
  nom: string;
  quantite: number;
  unite?: string;
  section?: string;
  couleur?: string;
  epaisseur?: string;
  largeur?: number;
  hauteur?: number;
  reference?: string;
  image_url?: string;
  dimension?: string;
  // --- Liaison catalogue matériaux (Phase 4) ---
  material_id?: string;        // FK vers materials.id
  format_standard?: string;    // ex: "Grande feuille - 4,20m/1,22m"
  cout_unitaire?: number;      // snapshot coût au moment du choix
  couleurs_dispo?: string[];   // couleurs proposées par le catalogue (restreint le select)

  // --- 🆕 Groupe (Feuille → Plaques) — Découpe & Vinyl uniquement ---
  // Si groupe_enfants est défini, cet item est un groupe "Feuille"
  groupe_enfants?: MaterialItem[];   // plaques contenues dans le groupe
  groupe_material_id?: string;       // FK → materials.id du matériau feuille
  groupe_nom?: string;               // nom du matériau feuille
  groupe_format?: string;            // format feuille (ex: "Grande feuille - 3,30m/2,14m")
  groupe_largeur?: number;           // dimension feuille en mètres
  groupe_hauteur?: number;           // dimension feuille en mètres
}

export interface TeamMember {
  id: string;
  nom: string;
  role: string;
  avatarUrl?: string;
}

export interface DeliveryAddress {
  label: string;
  lat: number;
  lng: number;
}

export interface AmountInputProps {
  value: number;
  onChange: (v: number) => void;
  label?: string;
  isEditable?: boolean;
  min?: number;
  step?: number;
}

export interface ImageUploadFieldProps {
  imageUrl?: string;
  onChange: (url: string) => void;
  isEditable?: boolean;
  label?: string;
  placeholder?: string;
}
