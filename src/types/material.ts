
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
