// Types pour le module financier

export interface FinancialCategory {
  id: string;
  name: string;
  type: 'expense' | 'income';
  icon: string;
  sort_order: number;
}

export type PaymentMethod = 'espèces' | 'virement' | 'chèque' | 'mobile_money';

export interface FinancialTransaction {
  id: string;
  project_id?: string;
  category_id?: string;
  type: 'expense' | 'income';
  amount: number;
  description?: string;
  date: string;
  payment_method?: PaymentMethod;
  reference?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Résolutions JOIN
  project_name?: string;
  category_name?: string;
  category_icon?: string;
}

export interface FinancialSummary {
  total_income: number;
  total_expenses: number;
  balance: number;
  by_category: { category: string; icon: string; amount: number; type: string }[];
  by_project: { project_id: string; project_name: string; income: number; expenses: number }[];
}

/* ── Types Demandes ── */
export type DemandeStatus = "envoye" | "paye" | "solde";

export interface DemandeItem {
  description: string;
  amount: number;
}

export interface Demande {
  id: string;
  number: string;
  applicant_id?: string;
  applicant_name: string;
  project_id?: string;
  description: string;
  items: DemandeItem[];
  total_amount: number;
  surplus_amount?: number;
  avoir_transaction_id?: string;
  monnaie_utilisee?: number;
  monnaie_source_ids?: string[];
  status: DemandeStatus;
  created_at: string;
  updated_at: string;
  // Résolutions JOIN
  project_name?: string;
}

export interface DemandeFilters {
  status?: DemandeStatus | "tous";
  period?: "day" | "week" | "month" | "year" | "all";
  search?: string;
  applicant_name?: string;
}
