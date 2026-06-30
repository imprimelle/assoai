import { useQueries } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProjectAddress {
  projectId: string;
  label: string;
  lat: number;
  lng: number;
  projectName: string;
  phase: string;
  dateLivraison?: string;
}

async function fetchAddress(projectId: string): Promise<ProjectAddress | null> {
  // Chercher la commande la plus récente liée à ce projet
  const { data: commandes } = await supabase
    .from('messages')
    .select('id, template_data')
    .eq('project_id', projectId)
    .eq('template_type', 'commande')
    .order('timestamp', { ascending: false })
    .limit(1);

  if (!commandes || commandes.length === 0) return null;

  const deliveryAddress = (commandes[0].template_data as any)?.data?.deliveryAddress;
  if (!deliveryAddress || !deliveryAddress.lat || !deliveryAddress.lng) return null;

  return {
    projectId,
    label: deliveryAddress.label || 'Adresse inconnue',
    lat: deliveryAddress.lat,
    lng: deliveryAddress.lng,
    projectName: '',
    phase: '',
  };
}

/**
 * Hook batch : récupère les adresses de livraison pour une liste de projets.
 */
export const useProjectsAddresses = (projectIds: string[], enabled = true) => {
  const queries = useQueries({
    queries: projectIds.map(pid => ({
      queryKey: ['project-address', pid],
      queryFn: () => fetchAddress(pid),
      staleTime: 60000,
      enabled: enabled && projectIds.length > 0,
    })),
  });

  const addresses = new Map<string, ProjectAddress>();
  queries.forEach(q => {
    if (q.data) addresses.set(q.data.projectId, q.data);
  });
  return addresses;
};
