import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DocumentSearchResult {
  id: string;
  templateType: string;
  numero: string;
  client: string;
  montant: number;
  date: string;
  version: number;
  projectId?: string;
}

/**
 * Recherche les factures existantes (tous utilisateurs)
 * pour permettre la liaison à un projet.
 *
 * Améliorations :
 * - Debounce 350ms pour éviter les requêtes en rafale
 * - Recherche côté serveur via Supabase .or() + ilike sur JSONB
 * - Fallback côté client pour les recherches plus flexibles
 * - Cache React Query par terme de recherche
 */
export const useDocumentSearch = (query: string) => {
  // Debounce : on retarde la recherche pour ne pas spammer Supabase
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 350);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query]);

  return useQuery({
    queryKey: ['document-search', debouncedQuery],
    queryFn: async (): Promise<DocumentSearchResult[]> => {
      if (!debouncedQuery || debouncedQuery.length < 2) return [];

      // 🔍 Recherche côté serveur — filtre JSONB via Supabase
      // On cherche dans le numéro de facture ET le nom du client
      const sanitizedQuery = debouncedQuery.replace(/%/g, ''); // Sécurité : éviter les injections de pattern
      const likePattern = `%${sanitizedQuery}%`;

      const { data, error } = await supabase
        .from('messages')
        .select('id, template_type, template_data, timestamp, project_id')
        .eq('template_type', 'facture')
        .filter('template_data->data->>is_latest', 'eq', 'true')
        .or(
          `template_data->data->>factureNumero.ilike.${likePattern},` +
          `template_data->data->>client->>nom.ilike.${likePattern}`
        )
        .order('timestamp', { ascending: false })
        .limit(25); // Réduit de 50 à 25 pour de meilleures performances

      if (error || !data || data.length === 0) {
        // Fallback : recherche élargie côté serveur + filtrage côté client
        return fallbackSearch(debouncedQuery);
      }

      return mapResults(data);
    },
    staleTime: 30_000, // Garde les résultats en cache 30s
    enabled: debouncedQuery.length >= 2,
  });
};

/**
 * Fallback : recherche élargie puis filtrage côté client.
 * Utilisé quand la recherche JSONB précise ne donne rien
 * (ex: recherche par montant, date, ou mot partiel).
 */
async function fallbackSearch(query: string): Promise<DocumentSearchResult[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('id, template_type, template_data, timestamp, project_id')
    .eq('template_type', 'facture')
    .filter('template_data->data->>is_latest', 'eq', 'true')
    .order('timestamp', { ascending: false })
    .limit(30);

  if (error || !data) return [];

  const q = query.toLowerCase();
  return mapResults(data).filter((d) => {
    return (
      d.numero.toLowerCase().includes(q) ||
      d.client.toLowerCase().includes(q) ||
      String(d.montant).includes(q)
    );
  });
}

/**
 * Mappe les résultats bruts Supabase vers DocumentSearchResult.
 */
function mapResults(data: any[]): DocumentSearchResult[] {
  return data.map((msg: any) => {
    const td = msg.template_data?.data || {};
    return {
      id: msg.id,
      templateType: msg.template_type,
      numero: td.factureNumero || '',
      client: td.client?.nom || '',
      montant: td.total || 0,
      date: td.dateEmission || msg.timestamp,
      version: td.version || 1,
      projectId: (msg as any).project_id || undefined,
    };
  });
}
