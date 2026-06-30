import React, { useState, useMemo } from "react";
import { useDemandes, useDeleteDemande, useUpdateDemandeStatus } from "../../hooks/useDemandes";
import { Search, Trash2, Loader2, ChevronDown, ChevronRight, CheckCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Demande } from "../../types/finance";

type Period = "day" | "week" | "month" | "year" | "all";
type StatusFilter = "tous" | "envoye" | "paye" | "solde";

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

/* ── Badge statut ── */
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; bg: string; text: string }> = {
    envoye: { label: "Envoyé", bg: "bg-blue-50", text: "text-blue-600" },
    paye: { label: "Payé", bg: "bg-green-50", text: "text-green-600" },
    solde: { label: "Utilisé", bg: "bg-gray-50", text: "text-gray-500" },
  };
  const c = config[status] || { label: status, bg: "bg-gray-50", text: "text-gray-500" };
  return (
    <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0", c.bg, c.text)}>
      {c.label}
    </span>
  );
}

/* ── Dialogue détail demande ── */
type DemandeDisplay = Demande & { project?: { name: string } };

function DemandeDetailDialog({
  demande,
  open,
  onClose,
  onDelete,
  onSolder,
}: {
  demande: DemandeDisplay | null;
  open: boolean;
  onClose: () => void;
  onDelete: (id: string) => void;
  onSolder: (id: string) => void;
}) {
  if (!open || !demande) return null;

  const itemCount = demande.items?.length || 0;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm max-h-[85vh] overflow-y-auto">
          {/* En-tête */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <StatusBadge status={demande.status} />
              <span className="text-[11px] text-gray-400">{demande.number}</span>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Montant */}
          <div className="text-2xl font-bold text-orange-600 mb-3">
            {formatFCFA(demande.total_amount)}
          </div>

          {/* Détails */}
          <div className="space-y-2 mb-4 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Demandeur</span>
              <span className="text-gray-900 font-medium">{demande.applicant_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Description</span>
              <span className="text-gray-900 text-right max-w-[200px] truncate">{demande.description || "—"}</span>
            </div>
            {demande.project?.name && (
              <div className="flex justify-between">
                <span className="text-gray-400">Projet</span>
                <span className="text-gray-900">{demande.project.name}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-400">Date</span>
              <span className="text-gray-900">{formatDate(demande.created_at)} {formatTime(demande.created_at)}</span>
            </div>
            {Number(demande.surplus_amount) > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-400">Monnaie</span>
                <span className="text-amber-600 font-medium">💰 {formatFCFA(Number(demande.surplus_amount))}</span>
              </div>
            )}
            {Number(demande.monnaie_utilisee) > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-400">Monnaie utilisée</span>
                <span className="text-green-600 font-medium">💰 {formatFCFA(Number(demande.monnaie_utilisee))}</span>
              </div>
            )}
          </div>

          {/* Items */}
          {itemCount > 0 && (
            <div className="mb-4">
              <p className="text-[10px] text-gray-400 mb-1.5">
                📋 {itemCount} article{itemCount > 1 ? "s" : ""}
              </p>
              <div className="space-y-1">
                {demande.items.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-xs text-gray-600 bg-gray-50 rounded px-2 py-1">
                    <span className="truncate max-w-[200px]">{item.description}</span>
                    <span className="ml-2 font-medium flex-shrink-0">{formatFCFA(item.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors">
              Fermer
            </button>
            {demande.status === "paye" && (
              <button
                onClick={() => { if (confirm("Déclarer cette demande comme utilisée ?")) { onSolder(demande.id); onClose(); } }}
                className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors"
              >
                <CheckCircle className="h-3.5 w-3.5" />
                Utiliser
              </button>
            )}
            {demande.status === "envoye" && (
              <button
                onClick={() => { if (confirm("Supprimer cette demande ?")) { onDelete(demande.id); onClose(); } }}
                className="flex items-center gap-1.5 px-4 py-2 border border-red-200 text-red-500 rounded-lg text-sm hover:bg-red-50 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Supprimer
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Composant principal ── */
interface DemandesListProps {
  balance: number;
  monnaie: number;
  onMonnaieClick?: () => void;
  applicantName: string;
}

export function DemandesList({ balance, monnaie, onMonnaieClick, applicantName }: DemandesListProps) {
  const [period, setPeriod] = useState<Period>("month");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("tous");
  const [search, setSearch] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [detailDemande, setDetailDemande] = useState<DemandeDisplay | null>(null);

  const { data: demandes, isLoading } = useDemandes({
    period,
    status: statusFilter === "tous" ? undefined : statusFilter,
    search: search || undefined,
    applicant_name: applicantName,
  });
  const deleteDemande = useDeleteDemande();
  const updateDemandeStatus = useUpdateDemandeStatus();

  const grouped = useMemo(() => {
    if (!demandes) return [];
    const groups = new Map<string, any[]>();
    for (const d of demandes) {
      const key = getPeriodKey(d.created_at, period);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(d);
    }
    const sortedGroups = [...groups.entries()].sort(([a], [b]) => b.localeCompare(a));
    // Trier dans chaque groupe par created_at décroissant
    for (const [, items] of sortedGroups) {
      items.sort((a: any, b: any) => {
        const catCmp = (b.created_at || "").localeCompare(a.created_at || "");
        if (catCmp !== 0) return catCmp;
        return (b.id || "").localeCompare(a.id || "");
      });
    }
    return sortedGroups;
  }, [demandes, period]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  };

  return (
    <div className="bg-white rounded-xl border pb-32">
      {/* Caisse + Monnaie */}
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div>
              <span className="text-[10px] text-gray-400 block">Caisse</span>
              <span className="text-lg font-bold text-gray-900">{formatFCFA(balance)}</span>
            </div>
            <div className="w-px h-8 bg-gray-300" />
            <div>
              <span className="text-[10px] text-gray-400 block">Monnaie</span>
              {monnaie > 0 && onMonnaieClick ? (
                <button type="button" onClick={onMonnaieClick}
                  className="text-sm font-semibold text-amber-600 hover:text-amber-700 hover:underline cursor-pointer"
                  title="Rendre de la monnaie">
                  {formatFCFA(monnaie)}
                </button>
              ) : (
                <span className="text-sm font-semibold text-amber-600">{formatFCFA(monnaie)}</span>
              )}
            </div>
          </div>
        </div>
      </div>

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
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-700">
            <option value="tous">🔘 Tous</option>
            <option value="envoye">📤 Envoyé</option>
            <option value="paye">✅ Payé</option>
            <option value="solde">📒 Utilisé</option>
          </select>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher une demande..." className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm" />
        </div>
      </div>

      {/* Liste groupée */}
      {isLoading ? (
        <div className="p-8 text-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
      ) : grouped.length === 0 ? (
        <div className="p-8 text-center text-gray-400 text-sm">Aucune demande</div>
      ) : (
        <div>
          {grouped.map(([periodKey, items]) => {
            const periodLabel = formatPeriodLabel(items[0].created_at, period);
            const isCollapsed = collapsedGroups.has(periodKey);
            const periodTotal = items.reduce((sum: number, d: any) => sum + Number(d.total_amount || 0), 0);

            return (
              <div key={periodKey}>
                <button type="button" onClick={() => toggleGroup(periodKey)}
                  className="w-full sticky top-[120px] z-20 bg-gray-100/95 backdrop-blur-sm px-4 py-2.5 flex items-center justify-between border-b border-gray-200 hover:bg-gray-200/80 transition-colors">
                  <div className="flex items-center gap-2">
                    {isCollapsed ? <ChevronRight className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                    <span className="text-sm font-semibold text-gray-700">{periodLabel}</span>
                    <span className="text-[11px] text-gray-400">{items.length} demande{items.length > 1 ? "s" : ""}</span>
                  </div>
                  <span className="text-[11px] text-orange-600 font-medium">{formatFCFA(periodTotal)}</span>
                </button>

                {!isCollapsed && items.map((d: DemandeDisplay) => (
                  <div
                    key={d.id}
                    onClick={() => setDetailDemande(d)}
                    className="px-4 py-2.5 hover:bg-gray-50 transition-colors flex items-center gap-3 border-b border-gray-50 cursor-pointer"
                  >
                    <StatusBadge status={d.status} />

                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-gray-700 truncate block">
                        {d.description || d.applicant_name}
                      </span>
                    </div>

                    {/* Badges monnaie */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {Number(d.surplus_amount) > 0 && (
                        <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded font-medium">
                          💰 {formatFCFA(Number(d.surplus_amount))}
                        </span>
                      )}
                      {Number(d.monnaie_utilisee) > 0 && (
                        <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded font-medium">
                          💰 ut.
                        </span>
                      )}
                    </div>

                    {/* Heure */}
                    {d.created_at && (
                      <span className="text-[10px] text-gray-400 flex-shrink-0">
                        {formatTime(d.created_at)}
                      </span>
                    )}

                    {/* Montant */}
                    <span className="text-sm font-semibold text-orange-600 whitespace-nowrap flex-shrink-0">
                      {formatFCFA(d.total_amount)}
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Dialogue détail */}
      <DemandeDetailDialog
        demande={detailDemande}
        open={!!detailDemande}
        onClose={() => setDetailDemande(null)}
        onDelete={(id) => deleteDemande.mutate(id)}
        onSolder={(id) => updateDemandeStatus.mutate({ id, status: "solde" })}
      />
    </div>
  );
}
