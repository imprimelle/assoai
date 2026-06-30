import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DemandesList } from "@/components/finance/DemandesList";
import { DemandesFooter } from "@/components/finance/DemandesFooter";
import { User } from "@/types";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { usePageVisit } from "@/hooks/usePageVisit";

interface DemandeProps {
  user: User;
}

/** Rôles qui peuvent modifier le demandeur */
const CAN_UNLOCK_APPLICANT = ["directeur", "directrice_adjointe"];

/** Catégorie "Monnaie rendue" (créée le 27 Juin 2026) */
const MONNAIE_RENDUE_CATEGORY_ID = "b23e6e07-5b23-49af-8ca8-e2b979e50dcf";

/** Hook : calcule Caisse, Monnaie, et Monnaie dispo pour l'utilisateur */
function useCaisseMonnaie(userName: string) {
  return useQuery({
    queryKey: ["caisseMonnaie", userName],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("demandes")
        .select("total_amount, surplus_amount, status, applicant_name") as any);
      if (error) return { caisse: 0, monnaie: 0, monnaieDisponible: 0 };

      // Caisse = total des demandes PAYÉES de CET utilisateur uniquement
      const payees = (data || []).filter((d: any) => d.status === "paye" && d.applicant_name === userName);

      const caisse = payees.reduce(
        (sum: number, d: any) => sum + Number(d.total_amount || 0),
        0
      );
      const monnaie = (data || [])
        .filter((d: any) => Number(d.surplus_amount) > 0)
        .reduce((sum: number, d: any) => sum + Number(d.surplus_amount || 0), 0);

      // ── Monnaie disponible pour CET utilisateur (surplus − réservations) ──
      const sourcesAvecSurplus = (data || []).filter(
        (d: any) => Number(d.surplus_amount) > 0 && d.applicant_name === userName
      );

      const sourceIds = sourcesAvecSurplus.map((s: any) => s.id);

      // Récupérer les réservations en cours (demandes 'envoye' qui référencent ces sources)
      let reserveParSource = new Map<string, number>();
      if (sourceIds.length > 0) {
        const { data: pending } = await (supabase
          .from("demandes")
          .select("id, monnaie_source_ids, monnaie_utilisee")
          .eq("status", "envoye")
          .not("monnaie_source_ids", "is", null) as any);

        for (const p of pending || []) {
          const ids: string[] = p.monnaie_source_ids || [];
          const montant = Number(p.monnaie_utilisee || 0);
          for (const sid of ids) {
            reserveParSource.set(sid, (reserveParSource.get(sid) || 0) + montant);
          }
        }
      }

      // Calculer le disponible réel
      let monnaieDisponible = 0;
      for (const src of sourcesAvecSurplus) {
        const brut = Number(src.surplus_amount || 0);
        const reserve = reserveParSource.get(src.id) || 0;
        monnaieDisponible += Math.max(0, brut - reserve);
      }

      return { caisse, monnaie, monnaieDisponible };
    },
    refetchInterval: 10_000,
  });
}

/* ── Dialogue de rendu de monnaie ── */
function RendreMonnaieDialog({
  open,
  onClose,
  maxAmount,
  userName,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  maxAmount: number;
  userName: string;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [success, setSuccess] = useState(false);
  const qc = useQueryClient();

  const renderMutation = useMutation({
    mutationFn: async (montant: number) => {
      const { data: sources } = await (supabase
        .from("demandes")
        .select("id, surplus_amount, number")
        .eq("applicant_name", userName)
        .gt("surplus_amount", 0)
        .order("created_at", { ascending: true }) as any);

      if (!sources || sources.length === 0) {
        throw new Error("Aucune monnaie disponible à rendre");
      }

      let resteARendre = montant;
      const sourcesConsommees: { id: string; number: string; consomme: number }[] = [];

      for (const src of sources) {
        if (resteARendre <= 0) break;
        const dispo = Number(src.surplus_amount || 0);
        const consomme = Math.min(dispo, resteARendre);
        const nouveauSurplus = dispo - consomme;

        await (supabase
          .from("demandes")
          .update({ surplus_amount: nouveauSurplus, updated_at: new Date().toISOString() })
          .eq("id", src.id) as any);

        sourcesConsommees.push({ id: src.id, number: src.number, consomme });
        resteARendre -= consomme;
      }

      const description = `Monnaie rendue ${userName} (${sourcesConsommees.map(s => s.number).join(", ")})`;
      const { error: txErr } = await (supabase
        .from("financial_transactions")
        .insert({
          type: "income",
          category_id: MONNAIE_RENDUE_CATEGORY_ID,
          amount: montant,
          date: new Date().toISOString().slice(0, 10),
          payment_method: "espèces",
          description,
          created_by: userName,
        }) as any);

      if (txErr) throw txErr;
      return { montant, sourcesConsommees };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["caisseMonnaie"] });
      qc.invalidateQueries({ queryKey: ["financialTransactions"] });
      qc.invalidateQueries({ queryKey: ["financialBalance"] });
      qc.invalidateQueries({ queryKey: ["monnaieCirculation"] });
      setSuccess(true);
      setTimeout(() => {
        onClose();
        onSuccess();
      }, 2000);
    },
  });

  React.useEffect(() => {
    if (open) {
      setAmount("");
      setSuccess(false);
    }
  }, [open]);

  if (!open) return null;

  const montant = Number(amount) || 0;
  const isValid = montant > 0 && montant <= maxAmount;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/30" onClick={success ? undefined : onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">💰 Rendre de la monnaie</h3>

          {success ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-3">✅</div>
              <p className="text-sm font-semibold text-green-700">
                {renderMutation.data?.montant.toLocaleString("fr-FR")} FCFA rendus avec succès
              </p>
              <p className="text-xs text-gray-400 mt-1">
                La monnaie a été déduite et une transaction a été créée
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-500 mb-4">
                Montant disponible :{" "}
                <span className="font-medium text-amber-600">
                  {maxAmount.toLocaleString("fr-FR")} FCFA
                </span>
              </p>

              <div className="mb-4">
                <label className="text-[10px] text-gray-400 block mb-1">Montant à rendre</label>
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    min="1"
                    max={maxAmount}
                    className="w-full pl-3 pr-16 py-2.5 border border-gray-200 rounded-lg text-lg font-semibold text-gray-900 placeholder:text-gray-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    autoFocus
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                    FCFA
                  </span>
                </div>
                {!isValid && amount !== "" && (
                  <p className="text-[10px] text-red-500 mt-1">
                    {montant <= 0
                      ? "Saisissez un montant positif"
                      : "Le montant dépasse votre monnaie disponible"}
                  </p>
                )}
              </div>

              {maxAmount > 0 && (
                <button
                  type="button"
                  onClick={() => setAmount(String(maxAmount))}
                  className="w-full mb-4 py-1.5 border border-amber-200 bg-amber-50 text-amber-700 rounded-lg text-xs font-medium hover:bg-amber-100 transition-colors"
                >
                  ↩️ Rendre tout ({maxAmount.toLocaleString("fr-FR")} FCFA)
                </button>
              )}

              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={() => renderMutation.mutate(montant)}
                  disabled={!isValid || renderMutation.isPending}
                  className="flex-1 py-2.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {renderMutation.isPending ? (
                    <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : null}
                  {renderMutation.isPending ? "En cours..." : "💰 Rendre"}
                </button>
              </div>

              {renderMutation.isError && (
                <p className="text-xs text-red-500 text-center mt-2">
                  ❌ {(renderMutation.error as Error).message}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

const Demande: React.FC<DemandeProps> = ({ user }) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [showRendreDialog, setShowRendreDialog] = useState(false);
  const { data } = useCaisseMonnaie(user.name);
  const balance = data?.caisse || 0;
  const monnaie = data?.monnaie || 0;
  const monnaieDisponible = data?.monnaieDisponible || 0;
  const { recordVisit } = usePageVisit();

  useEffect(() => {
    if (user) recordVisit(user.id, "demandes");
  }, [user, recordVisit]);

  const isUnlocked = CAN_UNLOCK_APPLICANT.includes(user.role);
  const lockedApplicant = isUnlocked
    ? undefined
    : { name: user.name, id: user.id };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 pt-4 pb-2">
        <h1 className="text-2xl font-bold text-gray-900">📤 Demandes</h1>
        <p className="text-sm text-gray-500 mt-1">
          Historique des demandes — utilise le formulaire en bas pour en créer une nouvelle
        </p>
      </div>

      <div className="max-w-5xl mx-auto px-4 space-y-6">
        <DemandesList
          balance={balance}
          monnaie={monnaieDisponible}
          applicantName={user.name}
          onMonnaieClick={monnaieDisponible > 0 ? () => setShowRendreDialog(true) : undefined}
        />
        <DemandesFooter
          onSuccess={() => setRefreshKey((k) => k + 1)}
          lockedApplicant={lockedApplicant}
          monnaieDisponible={monnaieDisponible}
        />
      </div>

      <RendreMonnaieDialog
        open={showRendreDialog}
        onClose={() => setShowRendreDialog(false)}
        maxAmount={monnaieDisponible}
        userName={user.name}
        onSuccess={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
};

export default Demande;
