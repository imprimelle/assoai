import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProjectDocument {
  id: string;
  templateType: 'facture' | 'devis' | 'commande' | 'cahier_des_charges';
  numero: string;
  titre: string;
  client: string;
  montant: number;
  date: string;
  version: number;
  is_latest: boolean;
  raw: any;
}

export const useProjectDocuments = (projectId?: string) => {
  return useQuery({
    queryKey: ['project-documents', projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('project_id', projectId)
        .not('template_type', 'is', null)
        // 🔧 FIX: exclure les versions périmées (is_latest=false)
        .or('template_data->data->>is_latest.is.null,template_data->data->>is_latest.eq.true')
        .order('timestamp', { ascending: false });

      if (error) throw new Error(error.message);
      if (!data) return [];

      return (data || []).map((msg: any) => {
        const td = msg.template_data?.data || {};
        const tpl = msg.template_type as ProjectDocument['templateType'];

        let numero = '';
        let titre = '';
        let client = '';
        let montant = 0;
        let date = msg.timestamp;

        switch (tpl) {
          case 'facture':
            numero = td.factureNumero || '';
            client = td.client?.nom || '';
            montant = td.total || 0;
            date = td.dateEmission || msg.timestamp;
            break;
          case 'devis':
            numero = td.devisNumero || '';
            client = td.client?.nom || '';
            montant = td.total || 0;
            date = td.dateEmission || msg.timestamp;
            break;
          case 'commande':
            numero = td.commandeNumero || '';
            client = td.client?.nom || '';
            montant = td.total || 0;
            date = td.dateCommande || msg.timestamp;
            break;
          case 'cahier_des_charges':
            numero = td.cdcNumero || '';
            titre = td.titre || '';
            client = td.client?.nom || '';
            date = msg.timestamp;
            break;
        }

        return {
          id: msg.id,
          templateType: tpl,
          numero,
          titre: titre || `${tpl === 'facture' ? 'Facture' : tpl === 'devis' ? 'Devis' : tpl === 'commande' ? 'Commande' : 'CDC'} ${numero}`,
          client,
          montant,
          date,
          version: td.version || 1,
          is_latest: td.is_latest !== false,
          raw: td,
        } as ProjectDocument;
      });
    },
    enabled: !!projectId,
    staleTime: 0, // Toujours frais — mise à jour immédiate après invalidation
  });
};
