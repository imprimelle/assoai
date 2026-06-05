
export type TemplateType = 
  | "facture" 
  | "devis" 
  | "commande" 
  | "cahier_des_charges"
  | "brief"       
  | "contact";     

export type TemplateAction =
  | "save"
  | "download"
  | "edit"
  | "share"
  | "ai"
  | "order"
  | "pdf";

export interface TemplateMetadata {
  displayName: string;
  description?: string;
  availableActions: TemplateAction[];
  mode: "readonly" | "editable";
  source?: "chatMessage" | "library" | "userGenerated";
}

export interface Template {
  templateType: TemplateType;
  data: import("./template-data").TemplateData;
  metadata?: TemplateMetadata;
}
