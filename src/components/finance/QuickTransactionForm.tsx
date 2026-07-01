import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFinancialCategories, useCreateTransaction } from "../../hooks/useFinancialTransactions";
import { useUpdateDemandeStatus } from "../../hooks/useDemandes";
import { MultiProjectSelector } from "./MultiProjectSelector";
import { cn } from "@/lib/utils";
import { Loader2, Check, ChevronUp, ChevronDown, X, Banknote, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/* ── Catégories constantes ── */
const MATERIEL_CATEGORY_ID = "67e51397-d477-4b78-8186-2b973e7dab7e";
const MONNAIE_CONFIEEE_CATEGORY_ID = "e992ecb5-0850-48fe-9f38-5e569b2cee20";
const COMPENSATION_MONNAIE_CATEGORY_ID = "8e20931c-77e6-4838-be80-45a037c9deec";

/* ── Mapping constant nom → ID (évite de dépendre de la query useFinancialCategories) ── */
const CATEGORY_NAME_TO_ID: Record<string, string> = {
  "Matériel": "67e51397-d477-4b78-8186-2b973e7dab7e",
  "Avance client": "1ddc1733-e6f7-419a-81b7-51bc447034ee",
  "Solde facture": "875eab8c-c4bf-4003-88b2-e830b7ab7dbf",
  "Paiement comptant": "bef9681d-cf07-4149-b482-42a9d41b195c",
  "Bureau": "309098f0-4eb9-4aac-84ce-8fa5def42dbe",
  "Maison": "0aa93d09-9085-4c3e-aec7-cd4fe367ebf8",
  "Autre dépense": "1a59b946-19e7-4c12-befc-b5daf0ca29db",
  "Autre revenu": "e6dd7136-d79d-4635-8fe2-5691d09604d3",
};

/* ── Catégories contextuelles ── */
const EXPENSE_CATEGORIES = [
  { name: "Matériel", icon: "🏗️" },
  { name: "Bureau", icon: "🖨️" },
  { name: "Maison", icon: "🏠" },
  { name: "Autre dépense", icon: "💸" },
];

const INCOME_CATEGORIES = [
  { name: "Avance client", icon: "💵" },
  { name: "Solde facture", icon: "✅" },
  { name: "Paiement comptant", icon: "💰" },
  { name: "Autre revenu", icon: "📥" },
];

/* ── Suggestions (historique + CDC) ── */
function useSuggestions(projectIds: string[], limit = 5) {
  const historyQuery = useQuery({
    queryKey: ["tx-suggestions-history", limit],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("financial_transactions")
        .select("description")
        .not("description", "is", null)
        .order("created_at", { ascending: false })
        .limit(100) as any);
      if (error) return [] as string[];
      const seen = new Set<string>();
      const uniq: string[] = [];
      for (const row of data || []) {
        const d = row.description as string;
        if (d && !seen.has(d.toLowerCase())) { seen.add(d.toLowerCase()); uniq.push(d); }
        if (uniq.length >= limit) break;
      }
      return uniq;
    },
    staleTime: 30_000,
  });

  const cdcQuery = useQuery({
    queryKey: ["tx-suggestions-cdc", projectIds],
    queryFn: async () => {
      if (!projectIds.length) return [] as string[];
      const { data: msgs, error } = await (supabase
        .from("messages")
        .select("template_data")
        .in("project_id", projectIds)
        .eq("template_type", "cdc")
        .order("timestamp", { ascending: false })
        .limit(5) as any);
      if (error || !msgs?.length) return [] as string[];

      const items: string[] = [];
      for (const m of msgs) {
        const td = (m as any).template_data;
        const data = td?.data || td || {};
        const produits = data.produits || data.articles || data.lignes || [];
        for (const p of produits) {
          const label = p.nom || p.designation || p.libelle || "";
          if (label) items.push(`📦 ${label}`);
        }
        const sections = data.materiauxSections || data.materiaux || {};
        if (typeof sections === "object") {
          for (const [_section, mats] of Object.entries(sections)) {
            if (Array.isArray(mats)) {
              for (const mat of mats) {
                const label = (mat as any).nom || (mat as any).designation || "";
                if (label) items.push(`🧱 ${label}`);
              }
            }
          }
        }
      }
      return [...new Set(items)].slice(0, 15);
    },
    enabled: projectIds.length > 0,
    staleTime: 60_000,
  });

  return {
    history: historyQuery.data || [],
    cdc: cdcQuery.data || [],
    isLoading: historyQuery.isLoading || cdcQuery.isLoading,
  };
}

/* ── Suggestions Demandes (groupées par batch) ── */
function useDemandesSuggestions() {
  return useQuery({
    queryKey: ["demandes-suggestions"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("demandes")
        .select("id, number, applicant_name, total_amount, items, batch_id, status, project_id, monnaie_utilisee")
        .eq("status", "envoye")
        .order("created_at", { ascending: false })
        .limit(50) as any);
      if (error || !data?.length) return [];

      // Grouper par batch_id
      const batchMap = new Map<string, any>();
      for (const d of data) {
        const key = d.batch_id || d.id;
        if (!batchMap.has(key)) {
          batchMap.set(key, {
            batch_id: key,
            applicant_name: d.applicant_name,
            project_id: d.project_id,
            demandes: [],
            total_amount: 0,
            monnaie_deja_couverte: 0,
            first_number: d.number,
          });
        }
        const batch = batchMap.get(key)!;
        batch.demandes.push(d);
        batch.total_amount += Number(d.total_amount || 0);
        batch.monnaie_deja_couverte += Number(d.monnaie_utilisee || 0);
      }

      return Array.from(batchMap.values());
    },
    refetchInterval: 10_000,
  });
}

function SuggestionDropdown({
  items,
  onSelect,
  onClose,
}: {
  items: { label: string; source: string }[];
  onSelect: (val: string) => void;
  onClose: () => void;
}) {
  if (items.length === 0) return null;
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute z-50 bottom-full left-0 right-0 mb-1 bg-white border rounded-lg shadow-lg max-h-52 overflow-y-auto">
        {items.map((item, i) => (
          <button
            key={i}
            type="button"
            onClick={() => { onSelect(item.label); onClose(); }}
            className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center gap-2 border-b border-gray-50 last:border-0"
          >
            <span className="text-xs text-gray-400 w-5">{item.source === "history" ? "📋" : "🏗️"}</span>
            <span className="text-gray-700 truncate">{item.label}</span>
          </button>
        ))}
      </div>
    </>
  );
}

/* ── Composant principal ── */
export function QuickTransactionForm({ onSuccess }: { onSuccess?: () => void }) {
  const qc = useQueryClient();
  const { data: allCategories } = useFinancialCategories();
  const createTx = useCreateTransaction();
  const updateDemandeStatus = useUpdateDemandeStatus();

  const [type, setType] = useState<"expense" | "income">("expense");
  const [expanded, setExpanded] = useState(false);
  const [categoryName, setCategoryName] = useState<string>("");
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [lines, setLines] = useState<{ description: string; amount: string }[]>([
    { description: "", amount: "" },
  ]);
  const [submitted, setSubmitted] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeLineIdx, setActiveLineIdx] = useState(0);

  // Mode pré-rempli depuis un batch de demandes
  const [prefillDemande, setPrefillDemande] = useState<any>(null);
  const [decaissement, setDecaissement] = useState<string>("");

  const suggestions = useSuggestions(projectIds);
  const { data: demandesSuggestions } = useDemandesSuggestions();

  const categoryId = CATEGORY_NAME_TO_ID[categoryName] || "";
  const categories = type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const today = new Date().toISOString().slice(0, 10);

  const linesTotal = lines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
  const decaissementAmount = Number(decaissement) || 0;
  const surplusAmount = Math.max(0, decaissementAmount - linesTotal);
  const subTotal = decaissementAmount || linesTotal;

  const formatDisplay = (raw: string): string => {
    const digits = raw.replace(/\D/g, "");
    if (!digits) return "";
    return Number(digits).toLocaleString("fr-FR").replace(/\u202f/g, " ");
  };

  const updateLine = (idx: number, field: "description" | "amount", value: string) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  };

  const addLine = () => {
    setLines((prev) => [...prev, { description: "", amount: "" }]);
  };

  const removeLine = (idx: number) => {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const resetForm = () => {
    setCategoryName("");
    setProjectIds([]);
    setLines([{ description: "", amount: "" }]);
    setSuggestionsOpen(false);
    setPrefillDemande(null);
    setDecaissement("");
  };

  /* ── Pré-remplir depuis un batch de demandes ── */
  const populateFromBatch = (batch: any) => {
    const demandes = batch.demandes || [];
    const monnaieDejaCouverte = batch.monnaie_deja_couverte || 0;
    setPrefillDemande({ 
      id: demandes[0]?.id,
      batch,
      demandes,
      applicant_name: batch.applicant_name,
      project_id: batch.project_id,
      number: batch.first_number,
      total_amount: batch.total_amount,
      monnaie_deja_couverte: monnaieDejaCouverte,
    });
    setType("expense");
    setCategoryName("Matériel");
    setDecaissement("");
    if (demandes.length === 0) {
      setLines([{ description: "", amount: "" }]);
    } else {
      setLines(
        demandes.map((d: any) => {
          const item = (d.items && d.items[0]) || {};
          return {
            description: item.description || d.description || "",
            amount: String(item.amount || d.total_amount || ""),
          };
        })
      );
    }
    if (batch.project_id) setProjectIds([batch.project_id]);
    setExpanded(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validLines = lines.filter((l) => l.description.trim() && Number(l.amount) > 0);
    if (!categoryId || validLines.length === 0) return;

    try {
      const pids = projectIds.length > 0 ? projectIds : [undefined];
      const catId = categoryId;

      // Créer une transaction par ligne × projet
      const batchDemandes = prefillDemande?.demandes || [];
      for (let i = 0; i < validLines.length; i++) {
        const line = validLines[i];
        const demandeLiee = batchDemandes[i] || null;
        for (const pid of pids) {
          await createTx.mutateAsync({
            type,
            category_id: catId,
            amount: Math.round(Number(line.amount)),
            date: today,
            payment_method: "espèces",
            project_id: pid || undefined,
            description: line.description.trim(),
            created_by: "Directeur",
            demande_id: demandeLiee?.id || prefillDemande?.id || undefined,
          });
        }
      }

      // Si surplus > 0 → créer transaction "Monnaie confiée"
      let monnaieTxId: string | null = null;
      if (prefillDemande && surplusAmount > 0) {
        const monnaieLabel = `Monnaie confiée ${prefillDemande.applicant_name} ${prefillDemande.number}`;
        const { data: monnaieData } = await (supabase
          .from("financial_transactions")
          .insert({
            type: "expense",
            category_id: MONNAIE_CONFIEEE_CATEGORY_ID,
            amount: Math.round(surplusAmount),
            date: today,
            payment_method: "espèces",
            project_id: prefillDemande.project_id || undefined,
            description: monnaieLabel,
            created_by: "Directeur",
            demande_id: prefillDemande.id,
          })
          .select()
          .single() as any);
        monnaieTxId = monnaieData?.id || null;
      }

      // ── 🆕 Option A : Consommer le surplus des sources (FIFO) au moment du paiement ──
      if (prefillDemande) {
        const monnaieDejaCouverte = prefillDemande.monnaie_deja_couverte || 0;

        if (monnaieDejaCouverte > 0) {
          // Récupérer les demandes du batch pour trouver les monnaie_source_ids
          const batchDemandesFull = prefillDemande.demandes || [];
          const premiereDemande = batchDemandesFull.length > 0 ? batchDemandesFull[0] : null;

          if (premiereDemande?.monnaie_source_ids?.length > 0) {
            const sourceIds: string[] = premiereDemande.monnaie_source_ids;

            // Récupérer les sources fraîches (surplus actuel)
            const { data: sources, error: srcErr } = await (supabase
              .from("demandes")
              .select("id, surplus_amount, number, applicant_name")
              .in("id", sourceIds)
              .order("created_at", { ascending: true }) as any);

            if (!srcErr && sources?.length) {
              let resteAConsommer = monnaieDejaCouverte;

              for (const src of sources) {
                if (resteAConsommer <= 0) break;
                const dispo = Number(src.surplus_amount || 0);
                const consomme = Math.min(dispo, resteAConsommer);
                const nouveauSurplus = dispo - consomme;

                await (supabase
                  .from("demandes")
                  .update({
                    surplus_amount: nouveauSurplus,
                    updated_at: new Date().toISOString(),
                    ...(nouveauSurplus <= 0 ? { status: "solde" } : {}),
                  })
                  .eq("id", src.id) as any);

                resteAConsommer -= consomme;
              }
            }
          }
        }
      }

      // Mettre à jour TOUTES les demandes du batch → payé + surplus
      if (prefillDemande) {
        const batchIds = batchDemandes.length > 0
          ? batchDemandes.map((d: any) => d.id)
          : [prefillDemande.id];

        const monnaieDejaCouverte = prefillDemande.monnaie_deja_couverte || 0;

        const updates: any = {
          status: "paye",
          surplus_amount: surplusAmount,
          updated_at: new Date().toISOString(),
        };
        if (monnaieTxId) updates.avoir_transaction_id = monnaieTxId;

        for (const demandeId of batchIds) {
          if (demandeId === prefillDemande.id || batchDemandes[0]?.id === demandeId) {
            await (supabase.from("demandes").update(updates).eq("id", demandeId) as any);
          } else {
            await (supabase.from("demandes").update({
              status: "paye",
              updated_at: new Date().toISOString(),
            }).eq("id", demandeId) as any);
          }
        }

        if (monnaieDejaCouverte > 0) {
          await (supabase
            .from("financial_transactions")
            .insert({
              type: "income",
              category_id: COMPENSATION_MONNAIE_CATEGORY_ID,
              amount: Math.round(monnaieDejaCouverte),
              date: today,
              payment_method: "espèces",
              project_id: prefillDemande.project_id || undefined,
              description: `Compensation monnaie ${prefillDemande.applicant_name} ${prefillDemande.number}`,
              created_by: "Directeur",
              demande_id: prefillDemande.id,
            }) as any);
        }
      }

      // Invalider les caches
      qc.invalidateQueries({ queryKey: ["caisseMonnaie"] });
      qc.invalidateQueries({ queryKey: ["demandesBalance"] });
      qc.invalidateQueries({ queryKey: ["financialTransactions"] });
      qc.invalidateQueries({ queryKey: ["financialBalance"] });
      qc.invalidateQueries({ queryKey: ["monnaieCirculation"] });

      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 2000);
      resetForm();
      onSuccess?.();
    } catch (err) {
      console.error("Erreur création transaction:", err);
    }
  };

  const openWithType = (t: "expense" | "income") => {
    setType(t);
    setCategoryName("");
    setExpanded(true);
  };

  const mergedSuggestions: { label: string; source: string }[] = [
    ...suggestions.history.map((h) => ({ label: h, source: "history" as const })),
    ...suggestions.cdc.map((c) => ({ label: c, source: "cdc" as const })),
  ];

  const validCount = lines.filter((l) => l.description.trim() && Number(l.amount) > 0).length;

  return (
    <>
      <div style={{ height: expanded ? Math.max(380, 220 + lines.length * 80) : 56 }} aria-hidden="true" />

      <div className="fixed bottom-0 left-0 right-0 bg-gray-100 border-t border-gray-300 shadow-lg z-50">
        {/* Suggestions Demandes */}
        {prefillDemande && (
          <div className="px-3 pt-2 pb-1 bg-orange-50 border-b border-orange-200">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-orange-700">
                  📤 Demande {prefillDemande.number} — {prefillDemande.applicant_name}
                </span>
                {prefillDemande.monnaie_deja_couverte > 0 && (
                  <span className="text-[10px] text-green-600 ml-2">
                    💰 {Number(prefillDemande.monnaie_deja_couverte).toLocaleString("fr-FR")} déjà couverts
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setPrefillDemande(null)}
                className="text-orange-400 hover:text-orange-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {!prefillDemande && demandesSuggestions && demandesSuggestions.length > 0 && (
          <div className="px-4 pt-2 pb-1 border-b border-gray-200 bg-amber-50/50">
            <p className="text-[10px] text-gray-400 mb-1.5">📤 Demandes en attente</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {demandesSuggestions.map((batch: any) => (
                <button
                  key={batch.batch_id}
                  type="button"
                  onClick={() => populateFromBatch(batch)}
                  className="flex-shrink-0 bg-white border border-amber-200 rounded-lg px-3 py-1.5 hover:border-orange-400 hover:shadow-sm transition-all text-left min-w-[140px]"
                >
                  <div className="flex items-center gap-1 text-[11px] font-medium text-gray-800">
                    <Banknote className="h-3 w-3 text-orange-500" />
                    <span className="truncate">{batch.applicant_name}</span>
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    {batch.first_number}{batch.demandes?.length > 1 ? ` +${batch.demandes.length - 1}` : ""}
                  </div>
                  <div className="text-xs font-semibold text-orange-600 mt-0.5">
                    {batch.monnaie_deja_couverte > 0
                      ? `${(batch.total_amount - batch.monnaie_deja_couverte).toLocaleString("fr-FR")} à donner`
                      : `${Number(batch.total_amount).toLocaleString("fr-FR")} FCFA`}
                  </div>
                  {batch.monnaie_deja_couverte > 0 && (
                    <div className="text-[9px] text-green-600 mt-0.5">
                      💰 {Number(batch.monnaie_deja_couverte).toLocaleString("fr-FR")} déjà couverts
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Dépense / Revenu */}
        <div className="flex items-center gap-2 px-3 pt-2 pb-1">
          <button type="button" onClick={() => openWithType("expense")}
            className={cn("flex-1 py-2 rounded-lg text-sm font-medium border transition-colors",
              type === "expense" ? "bg-red-500 text-white border-red-500 shadow-sm" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50")}>
            🧾 Dépense
          </button>
          <button type="button" onClick={() => openWithType("income")}
            className={cn("flex-1 py-2 rounded-lg text-sm font-medium border transition-colors",
              type === "income" ? "bg-green-500 text-white border-green-500 shadow-sm" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50")}>
            💵 Revenu
          </button>
          <button type="button" onClick={() => setExpanded(!expanded)}
            className={cn("p-2 transition-colors rounded-lg", expanded ? "text-gray-500 hover:text-gray-700" : "text-gray-500 hover:text-gray-700 bg-white border border-gray-300")}>
            {expanded ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
          </button>
        </div>

        {expanded && (
          <form onSubmit={handleSubmit} className="px-3 pb-3 space-y-2.5">
            {/* Lignes de dépenses */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    📝 Lignes
                  </p>
                  {/* Sélecteurs circulaires de catégorie */}
                  {!prefillDemande ? (
                    <div className="flex items-center gap-1">
                      {categories.map((cat) => (
                        <button
                          key={cat.name}
                          type="button"
                          onClick={() => setCategoryName(cat.name)}
                          className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center text-sm transition-all",
                            categoryName === cat.name
                              ? "bg-white border-2 border-blue-500 shadow-sm"
                              : "bg-white border border-gray-200 opacity-40 grayscale hover:opacity-70 hover:border-gray-400"
                          )}
                          title={cat.name}
                        >
                          {cat.icon}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[10px] text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                      🏗️ Matériel
                    </span>
                  )}
                </div>
                {lines.length > 1 && (
                  <span className="text-[10px] text-gray-400 bg-gray-200/50 px-2 py-0.5 rounded-full">
                    {lines.length} lignes
                  </span>
                )}
              </div>
              {lines.map((line, idx) => (
                <div key={idx}
                  className="flex items-start gap-2 bg-white rounded-xl border border-gray-200 shadow-sm hover:border-gray-300 hover:shadow transition-all p-2.5"
                >
                  {/* Description */}
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={line.description}
                      onChange={(e) => updateLine(idx, "description", e.target.value)}
                      onFocus={() => { setActiveLineIdx(idx); setSuggestionsOpen(true); }}
                      placeholder="Quoi ?"
                      className="w-full h-10 px-3 border-0 bg-transparent text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none"
                    />
                    {suggestionsOpen && activeLineIdx === idx && mergedSuggestions.length > 0 && (
                      <SuggestionDropdown
                        items={mergedSuggestions}
                        onSelect={(val) => { updateLine(idx, "description", val); setSuggestionsOpen(false); }}
                        onClose={() => setSuggestionsOpen(false)}
                      />
                    )}
                  </div>

                  {/* Divider */}
                  <div className="w-px h-10 bg-gray-100 shrink-0" />

                  {/* Montant */}
                  <div className="w-32 flex-shrink-0">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={line.amount ? formatDisplay(line.amount) : ""}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\s/g, "").replace(/\D/g, "");
                        updateLine(idx, "amount", raw);
                      }}
                      placeholder="Combien ?"
                      className="w-full h-10 px-0 border-0 bg-transparent text-sm font-bold text-gray-900 placeholder:text-gray-300 text-right focus:outline-none"
                    />
                  </div>

                  {/* Supprimer */}
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLine(idx)}
                      className="h-10 w-10 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={addLine}
                className="w-full flex items-center justify-center gap-1.5 py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-all active:scale-[0.98]"
              >
                <Plus className="h-4 w-4" />
                Ajouter une ligne
              </button>
            </div>

            {/* Décaissement */}
            {prefillDemande && (
              <div>
                <label className="text-[10px] text-gray-400 block mb-1">
                  💰 Décaissement (total donné à {prefillDemande.applicant_name})
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={decaissement}
                    onChange={(e) => setDecaissement(e.target.value)}
                    placeholder={String(linesTotal)}
                    className="w-full pl-2.5 pr-12 py-1.5 border border-orange-200 rounded-lg text-sm font-semibold text-orange-700 placeholder:text-gray-300 bg-orange-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    min="0"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-orange-400 pointer-events-none">
                    FCFA
                  </span>
                </div>
                {decaissementAmount > 0 && surplusAmount > 0 && (
                  <p className="text-[10px] text-amber-600 mt-1">
                    💰 Monnaie confiée calculée : {surplusAmount.toLocaleString("fr-FR")} FCFA
                  </p>
                )}
              </div>
            )}

            {/* Sous-total + Enregistrer */}
            <div className="flex items-center gap-2">
              <div className="flex-1 flex flex-col bg-white rounded-lg border border-gray-200 px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    {prefillDemande?.monnaie_deja_couverte > 0 ? "Reste à donner" : "Sous-total"}
                  </span>
                  <span className="text-sm font-bold text-gray-900">
                    {(prefillDemande?.monnaie_deja_couverte > 0
                      ? Math.max(0, subTotal - Number(prefillDemande.monnaie_deja_couverte))
                      : subTotal
                    ).toLocaleString("fr-FR").replace(/,/g, " ")} FCFA
                    {surplusAmount > 0 && (
                      <span className="text-[10px] text-orange-500 ml-1">
                        (dont {surplusAmount.toLocaleString("fr-FR")} monnaie confiée)
                      </span>
                    )}
                  </span>
                </div>
                {prefillDemande?.monnaie_deja_couverte > 0 && (
                  <div className="flex items-center justify-between mt-1 text-[10px] text-green-600">
                    <span>💰 Déjà couvert par monnaie</span>
                    <span className="font-medium">
                      −{Number(prefillDemande.monnaie_deja_couverte).toLocaleString("fr-FR")} FCFA
                    </span>
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={createTx.isPending || !categoryId || validCount === 0}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
                {createTx.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {submitted ? <Check className="h-4 w-4" /> : null}
                {submitted ? "Enregistré !" : `✅ Enregistrer${validCount > 1 ? ` (${validCount})` : ""}`}
              </button>
              <button type="button" onClick={resetForm}
                className="px-5 py-2.5 border border-gray-300 text-gray-500 rounded-lg text-sm hover:bg-white transition-colors">
                🔄
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
