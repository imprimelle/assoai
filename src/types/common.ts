
import type { TemplateType } from "./template";
import type { TemplateData } from "./template-data";

export interface Quote {
  type: string;
  templateType: string;
  numero?: string;
  client?: string;
  montant?: string; // Keep as string for consistency across UI
  title?: string;
  date?: string;
  additionalText?: string;
}
