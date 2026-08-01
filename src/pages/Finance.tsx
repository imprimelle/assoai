import React, { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { QuickTransactionForm } from "../components/finance/QuickTransactionForm";
import { TransactionList } from "../components/finance/TransactionList";
import { FinanceReports } from "../components/finance/FinanceReports";
import { useFinancialTransactions } from "../hooks/useFinancialTransactions";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { usePageVisit } from "@/hooks/usePageVisit";
import { ChevronDown, ChevronRight } from "lucide-react";

type FinanceTab = "tresorerie" | "rapports";

const TABS: { key: FinanceTab; label: string; icon: string }[] = [
  { key: "tresorerie", label: "Trésorerie", icon: "💰" },
  { key: "rapports", label: "Rapports", icon: "📑" },
];

function formatFCFA(value: number): string {
  return value.toLocaleString("fr-FR").replace(/,/g, " ") + " FCFA";
}

/* ── Hook : totaux ajustés — solde cumulatif (tout l'historique) + badge du mois courant ── */
function useAdjustedBalance() {
  const { data: txs, isLoading, isError, error } = useFinancialTransactions({ period: "all" });

  return useMemo(() => {
    const empty = {
      cumulativeIncome: 0, cumulativeExpenses: 0, cumulativeBalance: 0,
      monthIncome: 0, monthExpenses: 0, monthBalance: 0,
      monthLabel: "", monthEmpty: true,
      isLoading: false, isError: false, error: null as Error | null,
    };

    if (isLoading) return { ...empty, isLoading: true };
    if (isError) return { ...empty, isError: true, error: error as Error | null };
    if (!txs) return empty;

    const months = ["Janv", "Fév", "Mars", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const monthLabel = `${months[now.getMonth()]} ${now.getFullYear()}`;

    let cumulativeIncome = 0, cumulativeExpenses = 0;
    let monthIncome = 0, monthExpenses = 0;
    let monthHasTx = false;

    for (const tx of txs as any[]) {
      const catName: string = tx.category?.name || "";
      const amount = Number(tx.amount || 0);
      const isMonnaie = catName === "Monnaie confiée" || catName === "Compensation monnaie" || catName === "Monnaie rendue";

      if (isMonnaie) continue;

      const isCurrentMonth = (tx.date || "") >= monthStart;

      if (tx.type === "income") {
        cumulativeIncome += amount;
        if (isCurrentMonth) { monthIncome += amount; monthHasTx = true; }
      } else if (tx.type === "expense") {
        cumulativeExpenses += amount;
        if (isCurrentMonth) { monthExpenses += amount; monthHasTx = true; }
      }
    }

    return {
      cumulativeIncome, cumulativeExpenses,
      cumulativeBalance: cumulativeIncome - cumulativeExpenses,
      monthIncome, monthExpenses,
      monthBalance: monthIncome - monthExpenses,
      monthLabel,
      monthEmpty: !monthHasTx,
      isLoading: false, isError: false, error: null,
    };
  }, [txs, isLoading, isError, error]);
}

/* ── Hook : monnaie en circulation (surplus − réservations) ── */
function useMonnaieCirculation() {
  return useQuery({
    queryKey: ["monnaieCirculation"],
    queryFn: async () => {
      // Sources avec surplus > 0
      const { data: sources, error: srcErr } = await (supabase
        .from("demandes")
        .select("id, applicant_name, number, surplus_amount, status")
        .gt("surplus_amount", 0)
        .order("applicant_name")
        .order("created_at", { ascending: true }) as any);

      if (srcErr || !sources?.length) {
        return { totalBrut: 0, totalReserve: 0, totalDisponible: 0, parDemandeur: [] as any[] };
      }

      // Pour chaque source, calculer combien est réservé par des demandes 'envoye'
      const sourceIds = sources.map((s: any) => s.id);
      const { data: pending, error: pendErr } = await (supabase
        .from("demandes")
        .select("id, number, monnaie_source_ids, monnaie_utilisee")
        .eq("status", "envoye")
        .not("monnaie_source_ids", "is", null) as any);

      if (pendErr) {
        return { totalBrut: 0, totalReserve: 0, totalDisponible: 0, parDemandeur: [] as any[] };
      }

      // Construire un map : sourceId → total réservé
      const reserveParSource = new Map<string, number>();
      for (const p of pending || []) {
        const sourceIdsArr: string[] = p.monnaie_source_ids || [];
        const montant = Number(p.monnaie_utilisee || 0);
        for (const sid of sourceIdsArr) {
          reserveParSource.set(sid, (reserveParSource.get(sid) || 0) + montant);
        }
      }

      // Regrouper par demandeur
      const parDemandeur = new Map<string, { applicant: string; sources: any[]; brut: number; reserve: number }>();
      let totalBrut = 0;
      let totalReserve = 0;

      for (const src of sources) {
        const applicant = src.applicant_name || "Inconnu";
        const brut = Number(src.surplus_amount || 0);
        const reserve = reserveParSource.get(src.id) || 0;
        const disponible = Math.max(0, brut - reserve);

        if (!parDemandeur.has(applicant)) {
          parDemandeur.set(applicant, { applicant, sources: [], brut: 0, reserve: 0 });
        }
        const entry = parDemandeur.get(applicant)!;
        entry.sources.push({ ...src, reserve, disponible, brut });
        entry.brut += brut;
        entry.reserve += reserve;
        totalBrut += brut;
        totalReserve += reserve;
      }

      const totalDisponible = totalBrut - totalReserve;

      return {
        totalBrut,
        totalReserve,
        totalDisponible,
        parDemandeur: Array.from(parDemandeur.values()),
      };
    },
    refetchInterval: 10_000,
  });
}

export default function Finance() {
  const [tab, setTab] = useState<FinanceTab>("tresorerie");
  const [refreshKey, setRefreshKey] = useState(0);
  const [showMonnaieDetail, setShowMonnaieDetail] = useState(false);

  const adjusted = useAdjustedBalance();
  const { data: monnaieCirc } = useMonnaieCirculation();
  const user = useCurrentUser();
  const { recordVisit } = usePageVisit();

  const cumulativeBalance = adjusted.cumulativeBalance;
  const monnaieDisponible = monnaieCirc?.totalDisponible ?? 0;
  const monnaieBrut = monnaieCirc?.totalBrut ?? 0;
  const monnaieReserve = monnaieCirc?.totalReserve ?? 0;

  useEffect(() => {
    if (user) recordVisit(user.id, "finances");
  }, [user, recordVisit]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Titre */}
      <div className="max-w-5xl mx-auto px-4 pt-4 pb-2">
        <h1 className="text-2xl font-bold text-gray-900">💰 Finances</h1>
        <p className="text-sm text-gray-500 mt-1">Gestion des transactions, trésorerie et rapports</p>
      </div>

      {/* Solde — sticky sous le header */}
      <div className="sticky top-0 z-30 bg-gray-50 pb-2">
        <div className="max-w-5xl mx-auto px-4 space-y-2">
          {/* Barre opérationnelle */}
          <div className="bg-white rounded-xl border shadow-sm px-4 py-3">
            {adjusted.isError ? (
              <div className="text-center py-1">
                <p className="text-red-500 text-xs font-medium">⚠️ Erreur chargement solde</p>
                <p className="text-gray-400 text-[10px] mt-0.5">{adjusted.error?.message || "Impossible de charger les données"}</p>
              </div>
            ) : (
            <>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Trésorerie</span>
              <div className="flex items-center gap-3 text-xs">
                {adjusted.isLoading ? (
                  <span className="text-gray-400">—</span>
                ) : (
                  <>
                    <span className="text-green-600 font-medium">
                      {adjusted.cumulativeIncome > 0 ? "+" : ""}{formatFCFA(adjusted.cumulativeIncome)}
                    </span>
                    <span className="text-red-500 font-medium">
                      {adjusted.cumulativeExpenses > 0 ? "−" : ""}{formatFCFA(adjusted.cumulativeExpenses)}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-gray-400">Solde cumulé (hors flux monnaie)</span>
              <span className={cn(
                "text-sm font-bold px-3 py-0.5 rounded-full",
                adjusted.isLoading
                  ? "text-gray-400"
                  : cumulativeBalance >= 0
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-700"
              )}>
                {adjusted.isLoading
                  ? "—"
                  : (cumulativeBalance >= 0 ? "+" : "") + formatFCFA(cumulativeBalance)
                }
              </span>
            </div>
            {/* Badge du mois courant */}
            <div className={cn(
              "mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-[10px]",
              adjusted.monthEmpty ? "text-gray-400" : "text-gray-500"
            )}>
              <span>
                {adjusted.monthEmpty
                  ? `📅 Aucune transaction en ${adjusted.monthLabel}`
                  : `📅 ${adjusted.monthLabel}`
                }
              </span>
              {!adjusted.monthEmpty && (
                <span>
                  {adjusted.monthIncome > 0 && (
                    <span className="text-green-600 mr-2">+{formatFCFA(adjusted.monthIncome)}</span>
                  )}
                  {adjusted.monthExpenses > 0 && (
                    <span className="text-red-500">−{formatFCFA(adjusted.monthExpenses)}</span>
                  )}
                </span>
              )}
            </div>
            </>
            )}
          </div>

          {/* Barre monnaie en circulation */}
          <div className={cn(
            "bg-white rounded-xl border shadow-sm transition-all",
            showMonnaieDetail ? "pb-1" : ""
          )}>
            <button
              type="button"
              onClick={() => setShowMonnaieDetail(!showMonnaieDetail)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-amber-50/50 transition-colors rounded-xl"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-amber-700 uppercase tracking-wide">💰 Monnaie disponible</span>
                {monnaieReserve > 0 && (
                  <span className="text-[10px] text-amber-500">
                    ({formatFCFA(monnaieBrut)} bruts − {formatFCFA(monnaieReserve)} réservés)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={cn("text-sm font-bold", monnaieDisponible > 0 ? "text-amber-700" : "text-gray-400")}>
                  {formatFCFA(monnaieDisponible)}
                </span>
                {showMonnaieDetail
                  ? <ChevronDown className="h-4 w-4 text-gray-400" />
                  : <ChevronRight className="h-4 w-4 text-gray-400" />
                }
              </div>
            </button>

            {/* Détail expansible */}
            {showMonnaieDetail && (
              <div className="px-4 pb-3 pt-0 border-t border-amber-100">
                {monnaieCirc && monnaieCirc.parDemandeur.length > 0 ? (
                  <div className="space-y-3 mt-3">
                    {monnaieCirc.parDemandeur.map((entry) => (
                      <div key={entry.applicant}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-semibold text-gray-700">
                            👤 {entry.applicant}
                          </span>
                          <span className="text-xs font-medium text-amber-700">
                            {formatFCFA(entry.brut - entry.reserve)} disponibles
                          </span>
                        </div>
                        {entry.sources.map((src) => (
                          <div key={src.id} className="flex items-center justify-between ml-3 py-1 text-[11px] border-b border-gray-50 last:border-0">
                            <span className="text-gray-500">
                              {src.number} · {formatFCFA(src.brut)} bruts
                            </span>
                            <span className="text-gray-400">
                              {src.reserve > 0 ? `${formatFCFA(src.reserve)} réservés` : "disponible"}
                            </span>
                          </div>
                        ))}
                      </div>
                    ))}
                    <div className="flex justify-between text-[10px] text-gray-400 pt-2 border-t border-gray-100">
                      <span>Total : {formatFCFA(monnaieBrut)} bruts</span>
                      <span>{formatFCFA(monnaieReserve)} réservés · {formatFCFA(monnaieDisponible)} disponibles</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 text-center py-3 mt-2">
                    Aucune monnaie en circulation
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Onglets — sticky sous le solde */}
      <div className="sticky top-[180px] z-20 bg-gray-50 pt-2 pb-3">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 shadow-sm">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex-1 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-1.5",
                  tab === t.key
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                )}
              >
                <span>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Contenu */}
      <div className="max-w-5xl mx-auto px-4 space-y-6">
        {tab === "tresorerie" && (
          <>
            <TransactionList key={refreshKey} />
            <QuickTransactionForm onSuccess={() => setRefreshKey((k) => k + 1)} />
          </>
        )}
        {tab === "rapports" && <FinanceReports />}
      </div>
    </div>
  );
}
