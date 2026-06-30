import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import type { FinancialTransaction, FinancialCategory } from '../types/finance';

interface TransactionFilters {
  type?: 'expense' | 'income' | 'all';
  period?: 'day' | 'week' | 'month' | 'year' | 'all';
  project_id?: string;
  search?: string;
}

export function useFinancialCategories() {
  return useQuery({
    queryKey: ['financialCategories'],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('financial_categories')
        .select('*')
        .order('sort_order') as any);
      if (error) throw error;
      return data as FinancialCategory[];
    },
    staleTime: 5 * 60 * 1000, // cache 5 minutes
  });
}

export function useFinancialTransactions(filters: TransactionFilters) {
  return useQuery({
    queryKey: ['financialTransactions', filters],
    queryFn: async () => {
      let query = supabase.from('financial_transactions').select(`
        *,
        project:project_id (name),
        category:category_id (name, icon)
      `).order('date', { ascending: false });

      if (filters.type && filters.type !== 'all')
        query = query.eq('type', filters.type);
      if (filters.project_id)
        query = query.eq('project_id', filters.project_id);

      // Filtre période
      if (filters.period && filters.period !== 'all') {
        const now = new Date();
        let start: Date;
        switch (filters.period) {
          case 'day': start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break;
          case 'week': start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
          case 'month': start = new Date(now.getFullYear(), now.getMonth(), 1); break;
          case 'year': start = new Date(now.getFullYear(), 0, 1); break;
          default: start = new Date(0);
        }
        query = query.gte('date', start.toISOString().slice(0, 10));
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
    refetchInterval: 8_000, // auto-refresh toutes les 8 secondes
  });
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tx: Omit<FinancialTransaction, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await (supabase
        .from('financial_transactions')
        .insert(tx)
        .select()
        .single() as any);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financialTransactions'] });
    },
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('financial_transactions')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financialTransactions'] });
    },
  });
}
