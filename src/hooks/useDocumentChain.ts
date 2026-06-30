import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ChainDocument {
  id: string;
  templateType: string;
  numero: string;
  client: string;
  montant: number;
  date: string;
  version: number;
  data: any;
}

export interface DocumentChain {
  facture: ChainDocument | null;
  commande: ChainDocument | null;
  cahierDesCharges: ChainDocument | null;
}

/**
 * Résout la chaîne de dérivation à partir d'une facture.
 * - projectId FILTRE les documents : seuls ceux liés au projet sont inclus.
 * - Si projectId est absent, pas de filtre (compatibilité).
 *
 * Bug 10 : le paramètre factureDoc optionnel permet de peupler le champ facture.
 */
export const useDocumentChain = (
  factureNumero?: string,
  factureDoc?: ChainDocument | null,
  projectId?: string
) => {
  return useQuery({
    queryKey: ['document-chain', factureNumero, projectId],
    queryFn: async (): Promise<DocumentChain> => {
      const empty = { facture: null, commande: null, cahierDesCharges: null };
      if (!factureNumero) return { ...empty, facture: factureDoc || null };

      // 1. Chercher la commande liée à cette facture DANS CE PROJET
      let cmdQuery = supabase
        .from('messages')
        .select('id, template_type, template_data, timestamp, project_id')
        .eq('template_type', 'commande')
        .filter('template_data->data->>linked_facture_id', 'eq', factureNumero)
        .filter('template_data->data->>is_latest', 'eq', 'true')
        .limit(1);

      // Filtrer par project_id si fourni
      if (projectId) {
        cmdQuery = cmdQuery.eq('project_id', projectId);
      }

      const { data: commandes } = await cmdQuery;

      const cmd = commandes?.[0];
      const commande = cmd ? {
        id: cmd.id,
        templateType: cmd.template_type,
        numero: (cmd.template_data as any)?.data?.commandeNumero || '',
        client: (cmd.template_data as any)?.data?.client?.nom || '',
        montant: (cmd.template_data as any)?.data?.total || 0,
        date: (cmd.template_data as any)?.data?.dateCommande || cmd.timestamp,
        version: (cmd.template_data as any)?.data?.version || 1,
        data: (cmd.template_data as any)?.data,
      } : null;

      // 2. Chercher le CDC lié à la commande DANS CE PROJET
      let cahierDesCharges: ChainDocument | null = null;
      if (commande?.numero) {
        let cdcQuery = supabase
          .from('messages')
          .select('id, template_type, template_data, timestamp, project_id')
          .eq('template_type', 'cahier_des_charges')
          .filter('template_data->data->>commande_id', 'eq', commande.numero)
          .filter('template_data->data->>is_latest', 'eq', 'true')
          .limit(1);

        if (projectId) {
          cdcQuery = cdcQuery.eq('project_id', projectId);
        }

        const { data: cdcs } = await cdcQuery;

        const cdc = cdcs?.[0];
        if (cdc) {
          cahierDesCharges = {
            id: cdc.id,
            templateType: cdc.template_type,
            numero: (cdc.template_data as any)?.data?.cdcNumero || '',
            client: (cdc.template_data as any)?.data?.client?.nom || '',
            montant: 0,
            date: cdc.timestamp,
            version: (cdc.template_data as any)?.data?.version || 1,
            data: (cdc.template_data as any)?.data,
          };
        }
      }

      // Bug 10 : retourner la facture si fournie
      return { facture: factureDoc || null, commande, cahierDesCharges };
    },
    enabled: !!factureNumero,
    staleTime: 0, // Force le refetch immédiat après invalidation
  });
};
