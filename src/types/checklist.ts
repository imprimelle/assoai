// Types pour les checklists — AssoAI Gestion de Projet v3

export type ChecklistSection = 'facturation' | 'approvisionnement' | 'fabrication' | 'qualite' | 'livraison';

export type ChecklistPhase = 'facturation' | 'commande' | 'fabrication' | 'livraison' | 'termine';

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
  done_by?: string;
  done_at?: string;
  required_image?: boolean;
  image_url?: string;
  notes?: string;
}

export interface Checklist {
  id: string;
  project_id: string;
  task_id?: string;
  title: string;
  section?: ChecklistSection;
  phase?: ChecklistPhase;
  items: ChecklistItem[];
  total_items: number;
  completed_items: number;
  percentage: number;
  created_at: string;
  updated_at: string;
}

export interface ChecklistFormData {
  title: string;
  section?: ChecklistSection;
  phase?: ChecklistPhase;
  task_id?: string;
  items?: ChecklistItem[];
}

export interface ChecklistItemUpdate {
  itemId: string;
  done?: boolean;
  done_by?: string;
  image_url?: string;
  notes?: string;
}
