
import { TemplateType } from "./template";

// Define type for JSON that can come from Supabase
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface ProjectTemplates {
  factures: string[];
  commandes: string[];
  devis: string[];
  cahiers_des_charges: string[];
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  session_id: string;
  templates: ProjectTemplates;
  status?: 'actif' | 'en_attente' | 'termine' | 'archive';
  phase?: 'facturation' | 'commande' | 'fabrication' | 'livraison' | 'termine';
  date_livraison?: string;
  workflow_config?: ProjectWorkflow;
  chat_session_id?: string;
}

export interface ProjectFormData {
  name: string;
  description?: string;
}

// Workflow configuration
export interface ProjectWorkflow {
  auto_transitions: boolean;
  notifications: boolean;
  phases: ProjectPhase[];
}

export interface ProjectPhase {
  name: string;
  label: string;
  order: number;
  required_documents: TemplateType[];
  checklist_sections: string[];
  auto_tasks: AutoTask[];
}

export interface AutoTask {
  title: string;
  assignee: string;
  due_offset_days: number;
}

// Convert ProjectTemplates to JSON format compatible with Supabase
export const projectTemplatesToJson = (templates: ProjectTemplates): Json => {
  return {
    factures: templates.factures || [],
    commandes: templates.commandes || [],
    devis: templates.devis || [],
    cahiers_des_charges: templates.cahiers_des_charges || []
  };
};

// Helper function to ensure ProjectTemplates has the correct structure
export const normalizeTemplates = (templates: Json): ProjectTemplates => {
  const defaultTemplates: ProjectTemplates = {
    factures: [],
    commandes: [],
    devis: [],
    cahiers_des_charges: []
  };

  // If templates is not an object, return default
  if (typeof templates !== 'object' || templates === null || Array.isArray(templates)) {
    return defaultTemplates;
  }

  // Cast to avoid TS errors with Json type
  const templatesObj = templates as Record<string, unknown>;

  return {
    factures: Array.isArray(templatesObj.factures) ? templatesObj.factures as string[] : [],
    commandes: Array.isArray(templatesObj.commandes) ? templatesObj.commandes as string[] : [],
    devis: Array.isArray(templatesObj.devis) ? templatesObj.devis as string[] : [],
    cahiers_des_charges: Array.isArray(templatesObj.cahiers_des_charges) 
      ? templatesObj.cahiers_des_charges as string[] 
      : []
  };
};

// Helper function to normalize a Project from Supabase raw data
export const normalizeProject = (rawProject: Record<string, any>): Project => {
  return {
    id: rawProject.id,
    name: rawProject.name,
    description: rawProject.description,
    created_at: rawProject.created_at,
    updated_at: rawProject.updated_at,
    created_by: rawProject.created_by,
    session_id: rawProject.session_id,
    templates: normalizeTemplates(rawProject.templates),
    // Champs ajoutés par la migration 003 (refonte v3)
    status: rawProject.status || 'actif',
    phase: rawProject.phase || 'facturation',
    date_livraison: rawProject.date_livraison || undefined,
    workflow_config: rawProject.workflow_config || undefined,
    chat_session_id: rawProject.chat_session_id || undefined,
  };
};
