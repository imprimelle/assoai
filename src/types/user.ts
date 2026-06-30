
export type UserRole = 'directeur' | 'directrice_adjointe' | 'commerciale' | 'chef_technique' | 'technicien_adjoint' | 'superviseur_logistique';

export interface User {
  id: string;           // human_contacts.id
  name: string;         // human_contacts.name
  role: UserRole;       // human_contacts.role
  phone?: string;
  login?: string;
  session_id?: string;
}

export type CurrentUser = {
  id: string;
  role: UserRole;
  name: string;
  session_id?: string;
};
