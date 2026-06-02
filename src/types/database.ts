
export type MessageSender = 'user' | 'ai' | 'system';

export type CommandeStatus = 'en_attente' | 'confirmée' | 'en_cours' | 'terminée' | 'annulée';

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export interface MessageAttachment extends Record<string, Json> {
  type: string;
  url: string;
  name?: string;
}

export interface FactureDetails extends Record<string, Json> {
  description: string;
  quantite: number;
  prix_unitaire: number;
  sous_total: number;
  image_url?: string;
}

export interface CommandeItem extends Record<string, Json> {
  nom: string;
  quantite: number;
  prix_unitaire: number;
  sous_total: number;
  image_url?: string;
}

export interface Materiau extends Record<string, Json> {
  id: string;
  nom: string;
  dimension: string;
  quantite: number;
  unite?: string;
  type?: string;
  source?: string;
}

export interface NomenclatureEtape extends Record<string, Json> {
  etape: string;
  description: string;
  temps_estime: number;
}

export interface EquipeMembre extends Record<string, Json> {
  id: string;
  nom: string;
  role: string;
}

export interface DBMessage {
  id: string;
  session_id: string;
  user_id: string;
  sender: MessageSender;
  content: string | null;
  timestamp: string;
  attachments: MessageAttachment[];
  template_type: string | null;
  template_data: Json | null;
  quote: {
    type: string;
    templateType: string;
    numero?: string;
    client?: string;
    montant?: string; // Changed to string to be consistent
    title?: string;
  } | null;
  version_ref: string | null;
}

export interface DBFacture {
  id: string;
  numero: string;
  version: number;
  date_emission: string;
  client_nom: string;
  client_adresse: string | null;
  total: number;
  details: FactureDetails[];
  recu_image_url: string | null;
  is_latest: boolean;
  created_by: string;
  linked_to_commande_id: string | null;
}

export interface DBCommande {
  id: string;
  numero: string;
  version: number;
  date_commande: string;
  client_nom: string;
  client_adresse: string | null;
  statut: CommandeStatus;
  items: CommandeItem[];
  total: number;
  recu_image_url: string | null;
  linked_facture_id: string | null;
  is_latest: boolean;
  created_by: string;
}

export interface DBCahierDeCharge {
  id: string;
  titre: string;
  version: number;
  commande_id: string;
  facture_id: string | null;
  materiaux: Materiau[];
  dimensions: {
    largeur: number;
    hauteur: number;
    profondeur?: number;
  };
  technique: {
    type_structure: string;
    method_fabrication: string;
  };
  equipe: EquipeMembre[];
  images_items: string[];
  superviseur_id: string | null;
  commercial_id: string;
  is_latest: boolean;
  created_by: string;
}
