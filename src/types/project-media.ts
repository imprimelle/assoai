export type MediaType = 'photo' | 'document' | 'produit' | 'audio' | 'video';
export type MediaSource = 'upload' | 'whatsapp' | 'agent' | 'chat';

export interface ProjectMedia {
  id: string;
  project_id: string;
  url: string;
  type: MediaType;
  source: MediaSource;
  task_id?: string | null;
  checklist_item_id?: string | null;
  label?: string | null;
  created_by?: string | null;
  created_at: string;
}

export interface ProjectMediaFormData {
  project_id: string;
  url: string;
  type?: MediaType;
  source?: MediaSource;
  task_id?: string | null;
  checklist_item_id?: string | null;
  label?: string;
  created_by?: string;
}
