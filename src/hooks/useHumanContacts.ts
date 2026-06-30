import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface HumanContact {
  id: string;
  name: string;
  role: string;
  phone: string;
  whatsapp_jid: string | null;
  is_active: boolean;
  can_initialize_project: boolean;
  can_approve_phase: boolean;
  assigned_projects: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface HumanContactFormData {
  name: string;
  role: string;
  phone: string;
  whatsapp_jid?: string;
  is_active?: boolean;
  can_initialize_project?: boolean;
  can_approve_phase?: boolean;
  assigned_projects?: string[];
}

/** Génère le JID WhatsApp depuis le numéro de téléphone */
export function phoneToJid(phone: string): string {
  const cleaned = phone.trim().replace(/^\+/, '').replace(/[^0-9]/g, '');
  return `${cleaned}@s.whatsapp.net`;
}

/** Appelle l'API pour synchroniser l'allowlist WhatsApp */
async function syncWhatsAppAllowlist() {
  try {
    await fetch('/hermes/sync-whatsapp-allowlist', { method: 'POST' });
  } catch {
    // silencieux — l'allowlist sera sync au prochain ajout
  }
}

export const useHumanContacts = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: contacts, isLoading, error } = useQuery({
    queryKey: ['human_contacts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('human_contacts')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw new Error(error.message);
      return (data || []) as HumanContact[];
    },
  });

  const createContact = useMutation({
    mutationFn: async (form: HumanContactFormData) => {
      const jid = form.whatsapp_jid || phoneToJid(form.phone);
      const { data, error } = await supabase
        .from('human_contacts')
        .insert({
          name: form.name,
          role: form.role,
          phone: form.phone,
          whatsapp_jid: jid,
          is_active: form.is_active ?? true,
          can_initialize_project: form.can_initialize_project ?? false,
          can_approve_phase: form.can_approve_phase ?? false,
          assigned_projects: form.assigned_projects || null,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as HumanContact;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['human_contacts'] });
      syncWhatsAppAllowlist();
      toast({ title: 'Contact créé' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  const updateContact = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<HumanContact> & { id: string }) => {
      // Si le phone change, régénérer le JID
      if (updates.phone && !updates.whatsapp_jid) {
        updates.whatsapp_jid = phoneToJid(updates.phone);
      }
      const { data, error } = await supabase
        .from('human_contacts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as HumanContact;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['human_contacts'] });
      syncWhatsAppAllowlist();
      toast({ title: 'Contact mis à jour' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  const deleteContact = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('human_contacts').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['human_contacts'] });
      syncWhatsAppAllowlist();
      toast({ title: 'Contact supprimé' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  return { contacts, isLoading, error, createContact, updateContact, deleteContact };
};
