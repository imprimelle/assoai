import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Demande, DemandeFilters } from "../types/finance";

export function useDemandes(filters: DemandeFilters) {
  return useQuery({
    queryKey: ["demandes", filters],
    queryFn: async () => {
      let query = supabase
        .from("demandes")
        .select(`*, project:project_id (name)`)
        .order("created_at", { ascending: false });

      if (filters.status && filters.status !== "tous")
        query = query.eq("status", filters.status);

      if (filters.period && filters.period !== "all") {
        const now = new Date();
        let start: Date;
        switch (filters.period) {
          case "day": start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break;
          case "week": start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
          case "month": start = new Date(now.getFullYear(), now.getMonth(), 1); break;
          case "year": start = new Date(now.getFullYear(), 0, 1); break;
          default: start = new Date(0);
        }
        query = query.gte("created_at", start.toISOString());
      }

      // 🔒 Filtre contextuel par demandeur — chaque utilisateur ne voit que SES demandes
      if (filters.applicant_name)
        query = query.eq("applicant_name", filters.applicant_name);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as any[];
    },
    refetchInterval: 8_000,
  });
}

/**
 * Crée N demandes distinctes (une par ligne d'article).
 * NE crée PAS de transactions — ça sera fait dans Trésorerie.
 * NE consomme PAS le surplus immédiatement — la consommation est différée
 * au moment du paiement (QuickTransactionForm).
 *
 * ✅ Anti-double-réservation : vérifie que le surplus disponible
 *    (surplus_amount − réservations 'envoye') est suffisant.
 */
export function useCreateDemande() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      applicant_name: string;
      applicant_id?: string;
      project_id?: string;
      description: string;
      items: { description: string; amount: number }[];
      total_amount: number;
      monnaie_disponible?: number;
    }) => {
      const validItems = payload.items.filter(
        (it) => it.description.trim() && it.amount > 0
      );
      if (validItems.length === 0) throw new Error("Aucun article valide");

      const batchId = crypto.randomUUID ? crypto.randomUUID() :
        'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });

      const subTotal = validItems.reduce((s, it) => s + it.amount, 0);

      // ── Récupérer les sources de monnaie (FIFO, tous statuts) ──
      const { data: freshSources, error: srcErr } = await (supabase
        .from("demandes")
        .select("id, surplus_amount, number")
        .eq("applicant_name", payload.applicant_name)
        .gt("surplus_amount", 0)
        .order("created_at", { ascending: true }) as any);

      if (srcErr) throw srcErr;

      // ── Calculer le surplus RÉELLEMENT disponible (brut − réservations) ──
      const sourceIds = (freshSources || []).map((s: any) => s.id);

      // Récupérer les réservations en cours (demandes 'envoye' qui référencent ces sources)
      const { data: pendingReservations, error: pendErr } = sourceIds.length > 0
        ? await (supabase
            .from("demandes")
            .select("id, monnaie_source_ids, monnaie_utilisee")
            .eq("status", "envoye")
            .not("monnaie_source_ids", "is", null) as any)
        : { data: [], error: null };

      if (pendErr) throw pendErr;

      // Map : sourceId → montant déjà réservé
      const reserveParSource = new Map<string, number>();
      for (const p of pendingReservations || []) {
        const ids: string[] = p.monnaie_source_ids || [];
        const montant = Number(p.monnaie_utilisee || 0);
        for (const sid of ids) {
          reserveParSource.set(sid, (reserveParSource.get(sid) || 0) + montant);
        }
      }

      // Calculer le disponible réel de chaque source
      let monnaieDispoReelle = 0;
      const sourcesAvecDispo: { id: string; number: string; brut: number; reserve: number; disponible: number }[] = [];
      for (const src of freshSources || []) {
        const brut = Number(src.surplus_amount || 0);
        const reserve = reserveParSource.get(src.id) || 0;
        const disponible = Math.max(0, brut - reserve);
        if (disponible > 0) {
          sourcesAvecDispo.push({ id: src.id, number: src.number, brut, reserve, disponible });
        }
        monnaieDispoReelle += disponible;
      }

      // ── Vérification anti-double-réservation ──
      const monnaieUtilisee = Math.min(monnaieDispoReelle, subTotal);

      if (monnaieDispoReelle === 0 && monnaieUtilisee === 0) {
        // Aucune monnaie disponible — normal, continuer sans
      }

      // Sélectionner les sources (FIFO) pour enregistrer les IDs
      const monnaieSourceIds: string[] = [];
      let reste = monnaieUtilisee;
      for (const src of sourcesAvecDispo) {
        if (reste <= 0) break;
        monnaieSourceIds.push(src.id);
        reste -= Math.min(src.disponible, reste);
      }

      // ── Créer les demandes (sans toucher au surplus des sources) ──
      const createdIds: string[] = [];

      for (let i = 0; i < validItems.length; i++) {
        const item = validItems[i];
        const { data: numData, error: numErr } = await (supabase.rpc(
          "next_demande_number"
        ) as any);
        if (numErr) throw numErr;

        const isFirst = i === 0;

        const { data: newDemande, error: insertErr } = await (supabase
          .from("demandes")
          .insert({
            number: numData as string,
            applicant_name: payload.applicant_name,
            applicant_id: payload.applicant_id || null,
            project_id: payload.project_id || null,
            description: item.description.trim(),
            items: [{ description: item.description.trim(), amount: item.amount }],
            total_amount: item.amount,
            surplus_amount: 0,
            status: "envoye",
            batch_id: batchId,
            monnaie_utilisee: isFirst ? monnaieUtilisee : 0,
            monnaie_source_ids: isFirst ? monnaieSourceIds : [],
          })
          .select()
          .single() as any);

        if (insertErr) throw insertErr;
        createdIds.push(newDemande.id);
      }

      return { createdIds, count: createdIds.length, batchId, monnaieUtilisee, monnaieSourceIds };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["demandes"] });
      qc.invalidateQueries({ queryKey: ["caisseMonnaie"] });
      qc.invalidateQueries({ queryKey: ["demandesBalance"] });
      qc.invalidateQueries({ queryKey: ["monnaieCirculation"] });
    },
  });
}

export function useUpdateDemandeStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data, error } = await (supabase
        .from("demandes")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single() as any);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["demandes"] });
      qc.invalidateQueries({ queryKey: ["caisseMonnaie"] });
      qc.invalidateQueries({ queryKey: ["demandesBalance"] });
    },
  });
}

export function useDeleteDemande() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Récupérer la demande avant suppression (pour restaurer le surplus si nécessaire)
      const { data: demande } = await (supabase
        .from("demandes")
        .select("monnaie_source_ids, monnaie_utilisee, status")
        .eq("id", id)
        .single() as any);

      // Supprimer les transactions liées
      await supabase.from("financial_transactions").delete().eq("demande_id", id);

      // Supprimer la demande
      // Note : avec l'Option A (consommation différée), le surplus n'a pas été
      // consommé au moment de la création, donc rien à restaurer.
      const { error } = await supabase.from("demandes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["demandes"] });
      qc.invalidateQueries({ queryKey: ["financialTransactions"] });
      qc.invalidateQueries({ queryKey: ["caisseMonnaie"] });
      qc.invalidateQueries({ queryKey: ["monnaieCirculation"] });
    },
  });
}
