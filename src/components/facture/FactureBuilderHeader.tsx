// src/components/facture/FactureBuilderHeader.tsx
// Header collapsible pour le FactureBuilder — informations de la facture hors items.
// Inspiré de CdcBuilderHeader : barre résumée cliquable + contenu dépliable.
// v2: UnifiedAtInput pour la recherche client avec @.

import React, { useState } from "react";
import { ChevronDown, ChevronUp, Receipt, User, Calendar, Tag } from "lucide-react";
import type { FactureData } from "@/types";
import { formatCFA } from "@/utils/format";
import UnifiedAtInput from "@/components/shared/UnifiedAtInput";
import type { AtSuggestion } from "@/components/shared/UnifiedAtInput";

export interface FactureBuilderHeaderProps {
  data: FactureData;
  onChange: (data: FactureData) => void;
  messageId?: string;
}

function statutColor(s: string) {
  const l = (s || "").toLowerCase();
  if (l === "payé" || l === "livré") return "bg-green-100 text-green-700";
  if (l === "vérifié" || l === "infographie") return "bg-amber-100 text-amber-700";
  if (l === "demande") return "bg-blue-100 text-blue-700";
  return "bg-gray-100 text-gray-600";
}

const FactureBuilderHeader: React.FC<FactureBuilderHeaderProps> = ({
  data,
  onChange,
  messageId,
}) => {
  const [expanded, setExpanded] = useState(false);

  const title = data.client.nom || "Nouvelle facture";
  const summaryParts: string[] = [];
  if (data.factureNumero) summaryParts.push(data.factureNumero);
  if (data.statut && data.statut !== "Brouillon") summaryParts.push(data.statut);
  if (data.total > 0) summaryParts.push(formatCFA(data.total));
  const summary = summaryParts.join(" · ");
  const totalDisplay = data.total > 0 ? formatCFA(data.total) : "";

  const updateClient = (field: string, value: string) => {
    onChange({ ...data, client: { ...data.client, [field]: value } });
  };

  const handleClientSuggestion = (sugg: AtSuggestion) => {
    if (sugg.kind === "client" && sugg.data) {
      onChange({
        ...data,
        client: {
          nom: sugg.data.nom || sugg.label,
          adresse: sugg.data.adresse || data.client.adresse,
          telephone: sugg.data.telephone || data.client.telephone,
        },
      });
    }
  };

  const updateField = (field: string, value: any) => {
    onChange({ ...data, [field]: value });
  };

  const inputClass =
    "h-9 border border-gray-200 rounded-lg px-3 bg-white text-sm text-gray-700 placeholder:text-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-orange-400 outline-none w-full";
  const labelClass = "block text-[11px] font-medium text-gray-400 mb-1";

  return (
    <div className="mb-4">
      {/* Barre résumée */}
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-2.5
                   bg-white border border-gray-200 rounded-lg shadow-sm
                   hover:border-orange-300 hover:shadow transition-all duration-150"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="bg-orange-100 p-1.5 rounded-full shrink-0">
            <Receipt className="h-4 w-4 text-orange-600" />
          </div>
          <div className="min-w-0 text-left">
            <span className="text-sm font-bold text-gray-800 truncate">{title}</span>
            {summary && (
              <span className="text-xs text-gray-400 ml-2">{summary}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          {data.statut && data.statut !== "Brouillon" && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statutColor(data.statut)}`}>
              {data.statut}
            </span>
          )}
          {totalDisplay && (
            <span className="text-xs font-bold text-green-600">{totalDisplay}</span>
          )}
          {expanded ? (
            <ChevronUp size={16} className="text-gray-400" />
          ) : (
            <ChevronDown size={16} className="text-gray-400" />
          )}
        </div>
      </button>

      {/* Contenu dépliable */}
      {expanded && (
        <div className="mt-2 bg-white border border-gray-200 rounded-lg shadow-sm p-4 space-y-4">
          {/* ── Bloc Client (unifié @) ── */}
          <div>
            <label className={labelClass}>
              <User size={11} className="inline mr-1 text-gray-300" /> Client
            </label>

            {/* Champ unifié avec @ pour recherche client */}
            <UnifiedAtInput
              value={data.client.nom}
              onChange={(v) => updateClient("nom", v)}
              onSuggestionSelect={handleClientSuggestion}
              mode="client"
              placeholder="Nom du client… @ pour chercher dans l'historique"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              <div>
                <label className="text-[10px] text-gray-400 mb-0.5 block">Téléphone</label>
                <input
                  type="text"
                  value={data.client.telephone || ""}
                  onChange={(e) => updateClient("telephone", e.target.value)}
                  className={inputClass}
                  placeholder="+225 …"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 mb-0.5 block">Adresse</label>
                <input
                  type="text"
                  value={data.client.adresse}
                  onChange={(e) => updateClient("adresse", e.target.value)}
                  className={inputClass}
                  placeholder="Adresse"
                />
              </div>
            </div>
          </div>

          {/* ── Bloc Détails facture ── */}
          <div>
            <label className={labelClass}>
              <Calendar size={11} className="inline mr-1 text-gray-300" /> Détails
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className="text-[10px] text-gray-400 mb-0.5 block">Date d'émission</label>
                <input
                  type="date"
                  value={data.dateEmission?.split("T")[0] || ""}
                  onChange={(e) => updateField("dateEmission", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 mb-0.5 block">Statut</label>
                <select
                  value={data.statut || "Brouillon"}
                  onChange={(e) => updateField("statut", e.target.value)}
                  className={inputClass}
                >
                  <option value="Brouillon">Brouillon</option>
                  <option value="vérification">Vérification</option>
                  <option value="Vérifié">Vérifié</option>
                  <option value="Payé">Payé</option>
                  <option value="Livré">Livré</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-gray-400 mb-0.5 block">Délai livraison</label>
                <input
                  type="text"
                  value={data.delaiLivraison || ""}
                  onChange={(e) => updateField("delaiLivraison", e.target.value)}
                  className={inputClass}
                  placeholder="Ex: 2 semaines"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 mb-0.5 block">Échéancier</label>
                <input
                  type="text"
                  value={data.echeancier || ""}
                  onChange={(e) => updateField("echeancier", e.target.value)}
                  className={inputClass}
                  placeholder="Ex: 50% à la commande"
                />
              </div>
            </div>
          </div>

          {/* ── Bloc Remise ── */}
          <div>
            <label className={labelClass}>
              <Tag size={11} className="inline mr-1 text-gray-300" /> Remise
            </label>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  value={data.reduction ?? 0}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0;
                    const base = (data.details || []).reduce((s, d) => s + d.sous_total, 0);
                    onChange({ ...data, reduction: val, total: base - val });
                  }}
                  className="h-9 w-28 border border-gray-200 rounded-lg px-3 bg-white text-sm text-right"
                />
                <span className="text-xs text-gray-500">CFA</span>
              </div>
              <span className="text-xs text-gray-400">
                sur {formatCFA((data.details || []).reduce((s, d) => s + d.sous_total, 0))}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FactureBuilderHeader;
