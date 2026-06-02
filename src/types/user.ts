
export interface User {
  id: string;
  name: string;
  email: string;
  role?: "agent" | "super-agent";
  service?: "Commercial" | "Graphiste" | "Technique" | "Partenaire" | "Superviseur";
  session_id?: string;
}

export type CurrentUser = {
  id: string;
  role?: "agent" | "super-agent";
  service?: "Commercial" | "Graphiste" | "Technique" | "Partenaire" | "Superviseur";
  session_id?: string;
};
