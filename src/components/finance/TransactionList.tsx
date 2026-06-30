import React, { useState, useMemo } from "react";
import { useFinancialTransactions, useDeleteTransaction } from "../../hooks/useFinancialTransactions";
import { Search, Trash2, Loader2, Download, ChevronDown, ChevronRight, FileText, FileSpreadsheet, X, CircleDollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FinancialTransaction } from "../../types/finance";

type Period = "day" | "week" | "month" | "year" | "all";
type TypeFilter = "all" | "expense" | "income";

/* ── Marque Imprimelle ── */
const BRAND = {
  name: "IMPRIMELLE CÔTE D'IVOIRE",
  address: "Bingerville, nouvelle gare",
  phone: "(+225) 0102656626",
  blue: "#274293",
  orange: "#F4A261",
};

/* ── Formater période ── */
function formatPeriodLabel(dateStr: string, period: Period): string {
  const d = new Date(dateStr);
  const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
  const days = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
  switch (period) {
    case "day": return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
    case "week": {
      const day = d.getDay(); const monday = new Date(d); monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
      const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
      return `Sem. du ${monday.getDate()} ${months[monday.getMonth()]} — ${sunday.getDate()} ${months[sunday.getMonth()]}`;
    }
    case "month": return `${months[d.getMonth()]} ${d.getFullYear()}`;
    case "year": return `${d.getFullYear()}`;
    default: return dateStr;
  }
}

function getPeriodKey(dateStr: string, period: Period): string {
  const d = new Date(dateStr);
  switch (period) {
    case "day": return d.toISOString().slice(0, 10);
    case "week": { const day = d.getDay(); const monday = new Date(d); monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1)); return monday.toISOString().slice(0, 10); }
    case "month": return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    case "year": return `${d.getFullYear()}`;
    default: return dateStr;
  }
}

function formatFCFA(amount: number): string {
  return amount.toLocaleString("fr-FR").replace(/,/g, " ") + " FCFA";
}

function formatTime(isoString?: string): string {
  if (!isoString) return "";
  return new Date(isoString).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(isoString?: string): string {
  if (!isoString) return "";
  return new Date(isoString).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

/* ── Génération PDF branded Imprimelle ── */
async function generateFinancialPDF(transactions: any[], label: string): Promise<void> {
  const totalIncome = transactions.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + Number(t.amount), 0);
  const totalExpense = transactions.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + Number(t.amount), 0);
  const balance = totalIncome - totalExpense;

  const rows = transactions.map((tx: any) => `
    <tr>
      <td>${new Date(tx.date).toLocaleDateString("fr-FR")}</td>
      <td>${tx.category?.icon || ""} ${tx.category?.name || "—"}</td>
      <td>${tx.project?.name || "—"}</td>
      <td>${tx.description || "—"}</td>
      <td style="text-align:right;color:${tx.type === "expense" ? "#dc2626" : "#16a34a"}">
        ${tx.type === "expense" ? "−" : "+"}${formatFCFA(tx.amount)}
      </td>
    </tr>`).join("");

  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Rapport — ${label}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Roboto,sans-serif;color:#333;background:#f5f5f5;line-height:1.5}
  .bar{background:${BRAND.orange};height:6px;width:100%}
  .container{max-width:780px;margin:0 auto;padding:24px 20px;background:#fff;min-height:100vh}
  header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #e5e5e5;padding-bottom:12px;margin-bottom:16px}
  header h2{color:${BRAND.blue};font-size:18px} header p{font-size:12px;color:#777}
  h1{color:${BRAND.blue};font-size:22px;margin-bottom:4px}
  .sub{font-size:13px;color:#888;margin-bottom:16px}
  .summary{display:flex;gap:12px;margin-bottom:16px}
  .summary>div{flex:1;padding:12px;border-radius:8px;text-align:center;font-size:13px}
  .summary .inc{background:#ecfdf5;color:#065f46} .summary .exp{background:#fef2f2;color:#991b1b} .summary .bal{background:#eff6ff;color:#1e40af}
  .summary strong{display:block;font-size:18px;margin-top:2px}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th{background:${BRAND.blue};color:#fff;padding:8px 10px;text-align:left;font-weight:600;text-transform:uppercase;font-size:10px;letter-spacing:.5px}
  td{padding:8px 10px;border-bottom:1px solid #f0f0f0}
  tr:nth-child(even) td{background:#fafafa}
  footer{margin-top:24px;text-align:center;font-size:11px;color:#aaa;border-top:1px solid #e5e5e5;padding-top:12px}
</style></head>
<body>
<div class="bar"></div>
<div class="container">
  <header><h2>${BRAND.name}</h2><p>${BRAND.address}<br>${BRAND.phone}</p></header>
  <h1>📊 Rapport de trésorerie</h1>
  <div class="sub">${label} — ${transactions.length} transaction${transactions.length > 1 ? "s" : ""}</div>
  <div class="summary">
    <div class="inc">Revenus<strong>+${formatFCFA(totalIncome)}</strong></div>
    <div class="exp">Dépenses<strong>−${formatFCFA(totalExpense)}</strong></div>
    <div class="bal">Solde<strong>${balance >= 0 ? "+" : ""}${formatFCFA(balance)}</strong></div>
  </div>
  <table>
    <thead><tr><th>Date</th><th>Catégorie</th><th>Projet</th><th>Note</th><th style="text-align:right">Montant</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <footer>${BRAND.name} — ${BRAND.address} — ${BRAND.phone}</footer>
</div>
</body></html>`;

  const resp = await fetch("/api/pdf", { method: "POST", headers: { "Content-Type": "text/html" }, body: html });
  if (!resp.ok) throw new Error("PDF service error");
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `rapport-${label.replace(/\s+/g, "-").toLowerCase()}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Export CSV ── */
function exportPeriodCSV(transactions: any[], label: string) {
  const rows = [
    ["Type", "Catégorie", "Montant", "Date", "Projet", "Note"],
    ...transactions.map((tx: any) => [
      tx.type === "expense" ? "Dépense" : "Revenu",
      tx.category?.name || "", tx.amount, tx.date, tx.project?.name || "", tx.description || "",
    ]),
  ];
  const csv = rows.map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `tresorerie-${label.replace(/\s+/g, "-").toLowerCase()}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

/* ── Dialogue PDF/CSV ── */
function DownloadDialog({ open, onClose, onPDF, onCSV, label, loading }: {
  open: boolean; onClose: () => void; onPDF: () => void; onCSV: () => void; label: string; loading: boolean;
}) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-xs">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Télécharger le rapport</h3>
          <p className="text-xs text-gray-500 mb-4">{label}</p>
          <div className="space-y-2">
            <button onClick={onPDF} disabled={loading} className="w-full flex items-center gap-3 px-4 py-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              {loading ? "Génération..." : "📄 Document PDF"}
            </button>
            <button onClick={onCSV} className="w-full flex items-center gap-3 px-4 py-3 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
              <FileSpreadsheet className="h-4 w-4" />
              📋 Fichier CSV
            </button>
          </div>
          <button onClick={onClose} className="mt-3 w-full text-xs text-gray-400 hover:text-gray-600">Annuler</button>
        </div>
      </div>
    </>
  );
}

/* ── Dialogue détail transaction ── */
type TxDisplay = FinancialTransaction & { project?: { name: string }; category?: { name: string; icon: string }; demande_id?: string };

function TransactionDetailDialog({ tx, open, onClose, onDelete }: {
  tx: TxDisplay | null;
  open: boolean;
  onClose: () => void;
  onDelete: (id: string) => void;
}) {
  if (!open || !tx) return null;

  const typeInfo = tx.type === "expense"
    ? { label: "Dépense", color: "text-red-600 bg-red-50" }
    : { label: "Revenu", color: "text-green-600 bg-green-50" };

  const isMonnaieConfiee = tx.demande_id && tx.category?.name === "Monnaie confiée";
  const isCompensation = tx.demande_id && tx.category?.name === "Compensation monnaie";
  const isMonnaieRendue = tx.category?.name === "Monnaie rendue";

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
          {/* En-tête */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className={cn("px-2 py-0.5 rounded text-xs font-medium", typeInfo.color)}>{typeInfo.label}</div>
              {isMonnaieConfiee && <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded">💰 monnaie</span>}
              {isCompensation && <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">🔄 compensation</span>}
              {isMonnaieRendue && <span className="text-[10px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded">💰 monnaie rendu</span>}
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Montant */}
          <div className={cn("text-2xl font-bold mb-4", tx.type === "expense" ? "text-red-600" : "text-green-600")}>
            {tx.type === "expense" ? "−" : "+"}{formatFCFA(tx.amount)}
          </div>

          {/* Détails */}
          <div className="space-y-2 mb-4 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Catégorie</span>
              <span className="text-gray-900">{tx.category?.icon} {tx.category?.name || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Description</span>
              <span className="text-gray-900 text-right max-w-[200px] truncate">{tx.description || "—"}</span>
            </div>
            {tx.project?.name && (
              <div className="flex justify-between">
                <span className="text-gray-400">Projet</span>
                <span className="text-gray-900">{tx.project.name}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-400">Date</span>
              <span className="text-gray-900">{formatDate(tx.created_at || tx.date)} {formatTime(tx.created_at)}</span>
            </div>
            {tx.payment_method && (
              <div className="flex justify-between">
                <span className="text-gray-400">Paiement</span>
                <span className="text-gray-900 capitalize">{tx.payment_method.replace("_", " ")}</span>
              </div>
            )}
            {tx.reference && (
              <div className="flex justify-between">
                <span className="text-gray-400">Référence</span>
                <span className="text-gray-900 font-mono text-xs">{tx.reference}</span>
              </div>
            )}
            {tx.created_by && (
              <div className="flex justify-between">
                <span className="text-gray-400">Créé par</span>
                <span className="text-gray-900">{tx.created_by}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors">
              Fermer
            </button>
            <button
              onClick={() => { if (confirm("Supprimer cette transaction ?")) { onDelete(tx.id); onClose(); } }}
              className="flex items-center gap-1.5 px-4 py-2 border border-red-200 text-red-500 rounded-lg text-sm hover:bg-red-50 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Supprimer
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Composant principal ── */
export function TransactionList() {
  const [period, setPeriod] = useState<Period>("month");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [search, setSearch] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [dlDialog, setDlDialog] = useState<{ open: boolean; txs: any[]; label: string }>({ open: false, txs: [], label: "" });
  const [pdfLoading, setPdfLoading] = useState(false);
  const [detailTx, setDetailTx] = useState<TxDisplay | null>(null);

  const { data: transactions, isLoading } = useFinancialTransactions({ period, type: typeFilter, search: search || undefined });
  const deleteTx = useDeleteTransaction();

  const grouped = useMemo(() => {
    if (!transactions) return [];
    const groups = new Map<string, any[]>();
    for (const tx of transactions) {
      const key = getPeriodKey(tx.date, period);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(tx);
    }
    const sortedGroups = [...groups.entries()].sort(([a], [b]) => b.localeCompare(a));
    for (const [, txs] of sortedGroups) {
      txs.sort((a: any, b: any) => {
        const dateCmp = (b.date || "").localeCompare(a.date || "");
        if (dateCmp !== 0) return dateCmp;
        const catCmp = (b.created_at || "").localeCompare(a.created_at || "");
        if (catCmp !== 0) return catCmp;
        return (b.id || "").localeCompare(a.id || "");
      });
    }
    return sortedGroups;
  }, [transactions, period]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  };

  return (
    <div className="bg-white rounded-xl border pb-32">
      {/* Filtres */}
      <div className="p-4 border-b space-y-2.5">
        <div className="flex gap-2">
          <select value={period} onChange={(e) => setPeriod(e.target.value as Period)} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-700">
            <option value="day">📅 Jour</option>
            <option value="week">📆 Semaine</option>
            <option value="month">🗓️ Mois</option>
            <option value="year">📊 Année</option>
            <option value="all">♾️ Tout</option>
          </select>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as TypeFilter)} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-700">
            <option value="all">🔘 Tout</option>
            <option value="expense">🧾 Dépenses</option>
            <option value="income">💵 Revenus</option>
          </select>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher une transaction..." className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm" />
        </div>
      </div>

      {/* Liste groupée */}
      {isLoading ? (
        <div className="p-8 text-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
      ) : grouped.length === 0 ? (
        <div className="p-8 text-center text-gray-400 text-sm">Aucune transaction</div>
      ) : (
        <div>
          {grouped.map(([periodKey, txs]) => {
            const periodLabel = formatPeriodLabel(txs[0].date, period);
            const isCollapsed = collapsedGroups.has(periodKey);
            const periodTotal = txs.reduce((acc: { inc: number; exp: number }, tx: any) => {
              if (tx.type === "income") acc.inc += Number(tx.amount); else acc.exp += Number(tx.amount); return acc;
            }, { inc: 0, exp: 0 });

            return (
              <div key={periodKey}>
                <button type="button" onClick={() => toggleGroup(periodKey)}
                  className="w-full sticky top-[120px] z-20 bg-gray-100/95 backdrop-blur-sm px-4 py-2.5 flex items-center justify-between border-b border-gray-200 hover:bg-gray-200/80 transition-colors">
                  <div className="flex items-center gap-2">
                    {isCollapsed ? <ChevronRight className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                    <span className="text-sm font-semibold text-gray-700">{periodLabel}</span>
                    <span className="text-[11px] text-gray-400">{txs.length} transaction{txs.length > 1 ? "s" : ""}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-gray-400">
                      {periodTotal.inc > 0 && <span className="text-green-600 mr-2">+{formatFCFA(periodTotal.inc)}</span>}
                      {periodTotal.exp > 0 && <span className="text-red-500">{formatFCFA(-periodTotal.exp)}</span>}
                    </span>
                    <span onClick={(e) => { e.stopPropagation(); setDlDialog({ open: true, txs, label: periodLabel }); }}
                      className="p-1 text-gray-400 hover:text-blue-600 transition-colors rounded" title="Télécharger le rapport">
                      <Download className="h-4 w-4" />
                    </span>
                  </div>
                </button>

                {!isCollapsed && txs.map((tx: TxDisplay) => {
                  const typeInfo = tx.type === "expense"
                    ? { label: "Dépense", color: "text-red-600 bg-red-50" }
                    : { label: "Revenu", color: "text-green-600 bg-green-50" };
                  const isMonnaieConfiee = tx.demande_id && tx.category?.name === "Monnaie confiée";
                  const isCompensation = tx.demande_id && tx.category?.name === "Compensation monnaie";
                  const isMonnaieRendue = tx.category?.name === "Monnaie rendue";

                  return (
                    <div
                      key={tx.id}
                      onClick={() => setDetailTx(tx)}
                      className="px-4 py-2.5 hover:bg-gray-50 transition-colors flex items-center gap-3 border-b border-gray-50 cursor-pointer"
                    >
                      {/* Type + stickers côte à côte */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <div className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", typeInfo.color)}>{typeInfo.label}</div>
                        {isMonnaieConfiee && <span className="text-[9px] bg-orange-100 text-orange-600 px-1 py-0.5 rounded">💰</span>}
                        {isCompensation && <span className="text-[9px] bg-blue-100 text-blue-600 px-1 py-0.5 rounded">🔄</span>}
                        {isMonnaieRendue && <span className="text-[9px] bg-green-100 text-green-600 px-1 py-0.5 rounded">💰</span>}
                      </div>

                      {/* Description */}
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-gray-700 truncate block">
                          {tx.description || tx.category?.name || "—"}
                        </span>
                      </div>

                      {/* Heure */}
                      {tx.created_at && (
                        <span className="text-[10px] text-gray-400 flex-shrink-0">
                          {formatTime(tx.created_at)}
                        </span>
                      )}

                      {/* Montant */}
                      <div className={cn("text-sm font-semibold whitespace-nowrap flex-shrink-0", tx.type === "expense" ? "text-red-600" : "text-green-600")}>
                        {tx.type === "expense" ? "−" : "+"}{formatFCFA(tx.amount)}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Dialogue téléchargement */}
      <DownloadDialog
        open={dlDialog.open}
        label={dlDialog.label}
        loading={pdfLoading}
        onClose={() => setDlDialog({ open: false, txs: [], label: "" })}
        onPDF={async () => {
          setPdfLoading(true);
          try { await generateFinancialPDF(dlDialog.txs, dlDialog.label); }
          catch (e) { alert("Erreur lors de la génération du PDF."); console.error(e); }
          finally { setPdfLoading(false); setDlDialog({ open: false, txs: [], label: "" }); }
        }}
        onCSV={() => { exportPeriodCSV(dlDialog.txs, dlDialog.label); setDlDialog({ open: false, txs: [], label: "" }); }}
      />

      {/* Dialogue détail transaction */}
      <TransactionDetailDialog
        tx={detailTx}
        open={!!detailTx}
        onClose={() => setDetailTx(null)}
        onDelete={(id) => deleteTx.mutate(id)}
      />
    </div>
  );
}
