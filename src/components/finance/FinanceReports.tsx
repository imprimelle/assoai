import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Download, Loader2 } from "lucide-react";

/* ── Noms des catégories « flux monnaie » ── */
const MONNAIE_CATEGORY_NAMES = ["Monnaie confiée", "Compensation monnaie", "Monnaie rendue"];

function formatFCFA(value: number): string {
  return value.toLocaleString("fr-FR").replace(/,/g, " ") + " FCFA";
}

export function FinanceReports() {
  const { data: byCategory, isLoading } = useQuery({
    queryKey: ["financialByCategory", "month", "reports"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc("get_financial_by_category", {
        p_project_id: null,
        p_time_period: "month",
      }) as any);
      if (error) throw error;
      return data || [];
    },
  });

  // Séparer en deux groupes
  const allItems = (byCategory || []) as any[];
  const operationnel = allItems.filter((c: any) => !MONNAIE_CATEGORY_NAMES.includes(c.name || c.category));
  const fluxMonnaie = allItems.filter((c: any) => MONNAIE_CATEGORY_NAMES.includes(c.name || c.category));

  const opExpenses = operationnel.filter((c: any) => c.type === "expense");
  const opIncomes = operationnel.filter((c: any) => c.type === "income");
  const totalOpExpenses = opExpenses.reduce((sum: number, c: any) => sum + Number(c.amount), 0);
  const totalOpIncome = opIncomes.reduce((sum: number, c: any) => sum + Number(c.amount), 0);
  const opBalance = totalOpIncome - totalOpExpenses;

  // Totaux flux monnaie
  const monnaieConfiee = fluxMonnaie
    .filter((c: any) => (c.name || c.category) === "Monnaie confiée")
    .reduce((sum: number, c: any) => sum + Number(c.amount), 0);
  const monnaieCompensee = fluxMonnaie
    .filter((c: any) => (c.name || c.category) === "Compensation monnaie")
    .reduce((sum: number, c: any) => sum + Number(c.amount), 0);
  const monnaieRendue = fluxMonnaie
    .filter((c: any) => (c.name || c.category) === "Monnaie rendue")
    .reduce((sum: number, c: any) => sum + Number(c.amount), 0);

  const generateExportCSV = () => {
    const rows = [
      ["Type", "Catégorie", "Montant"],
      ...opExpenses.map((c: any) => ["Dépense", c.category || c.name, formatFCFA(c.amount)]),
      ...opIncomes.map((c: any) => ["Revenu", c.category || c.name, formatFCFA(c.amount)]),
      ["", "TOTAL OPÉRATIONNEL (dépenses)", formatFCFA(totalOpExpenses)],
      ["", "TOTAL OPÉRATIONNEL (revenus)", formatFCFA(totalOpIncome)],
      ["", "SOLDE OPÉRATIONNEL", formatFCFA(opBalance)],
      [],
      ...fluxMonnaie.map((c: any) => ["Flux monnaie", c.category || c.name, formatFCFA(c.amount)]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rapport-finances-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Résumé opérationnel */}
      <div className="bg-white rounded-xl border p-6">
        <h3 className="text-sm font-medium text-gray-700 mb-1">📊 Résumé opérationnel — Ce mois</h3>
        <p className="text-[11px] text-gray-400 mb-4">Hors flux monnaie (confiée, compensation, rendue)</p>
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-gray-400 mx-auto" />
        ) : (
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-xs text-gray-500">Revenus réels</p>
              <p className="text-lg font-bold text-green-700">{formatFCFA(totalOpIncome)}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <p className="text-xs text-gray-500">Dépenses réelles</p>
              <p className="text-lg font-bold text-red-700">{formatFCFA(totalOpExpenses)}</p>
            </div>
            <div className={`rounded-lg p-4 ${opBalance >= 0 ? "bg-blue-50" : "bg-amber-50"}`}>
              <p className="text-xs text-gray-500">Solde réel</p>
              <p className={`text-lg font-bold ${opBalance >= 0 ? "text-blue-700" : "text-amber-700"}`}>
                {opBalance >= 0 ? "+" : ""}{formatFCFA(opBalance)}
              </p>
            </div>
          </div>
        )}

        {/* Flux monnaie */}
        {!isLoading && fluxMonnaie.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <h4 className="text-xs font-medium text-amber-700 mb-2">💰 Flux monnaie (ajustements comptables)</h4>
            <div className="space-y-1 text-xs">
              {monnaieConfiee > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Monnaie confiée (remise aux demandeurs)</span>
                  <span className="text-red-500 font-medium">−{formatFCFA(monnaieConfiee)}</span>
                </div>
              )}
              {monnaieCompensee > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Compensation monnaie (utilisée par les demandeurs)</span>
                  <span className="text-green-500 font-medium">+{formatFCFA(monnaieCompensee)}</span>
                </div>
              )}
              {monnaieRendue > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Monnaie rendue (restituée par les demandeurs)</span>
                  <span className="text-green-500 font-medium">+{formatFCFA(monnaieRendue)}</span>
                </div>
              )}
              <div className="flex justify-between pt-1.5 border-t border-gray-100 mt-1.5 font-medium">
                <span className="text-amber-600">Monnaie nette en circulation</span>
                <span className={monnaieConfiee - monnaieCompensee - monnaieRendue >= 0 ? "text-amber-600" : "text-green-600"}>
                  {formatFCFA(monnaieConfiee - monnaieCompensee - monnaieRendue)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Détail par catégorie */}
      <div className="bg-white rounded-xl border p-6">
        <h3 className="text-sm font-medium text-gray-700 mb-4">Détail par catégorie</h3>
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-gray-400 mx-auto" />
        ) : allItems.length > 0 ? (
          <div className="space-y-4">
            {/* Opérationnel */}
            {operationnel.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">📋 Opérationnel</p>
                {["expense", "income"].map((type) => {
                  const items = operationnel.filter((c: any) => c.type === type);
                  if (items.length === 0) return null;
                  return (
                    <div key={type} className="mb-2">
                      {items.map((item: any) => (
                        <div key={item.category || item.name} className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0">
                          <span className="text-sm text-gray-700">{item.category || item.name}</span>
                          <span className={`text-sm font-medium ${type === "expense" ? "text-red-600" : "text-green-600"}`}>
                            {type === "expense" ? "−" : "+"}{formatFCFA(Number(item.amount))}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Flux monnaie */}
            {fluxMonnaie.length > 0 && (
              <div>
                <p className="text-xs font-medium text-amber-600 mb-2">💰 Flux monnaie</p>
                {fluxMonnaie.map((item: any) => (
                  <div key={item.category || item.name} className="flex justify-between items-center py-1.5 border-b border-amber-50 last:border-0">
                    <span className="text-sm text-amber-700">{item.category || item.name}</span>
                    <span className={`text-sm font-medium ${item.type === "expense" ? "text-red-500" : "text-green-500"}`}>
                      {item.type === "expense" ? "−" : "+"}{formatFCFA(Number(item.amount))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">Aucune transaction ce mois</p>
        )}
      </div>

      {/* Export */}
      <button
        onClick={generateExportCSV}
        className="w-full flex items-center justify-center gap-2 py-3 bg-white border rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <Download className="h-4 w-4" />
        Exporter en CSV
      </button>
    </div>
  );
}
