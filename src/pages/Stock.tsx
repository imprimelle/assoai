// src/pages/Stock.tsx
// Page Stock — gestion logistique des matériaux de découpe.
// La PIÈCE est l'unité ; la FEUILLE est un lot de provenance (d'où viennent les pièces + date).
// 2 onglets : « Stock » (pièces, vue principale) et « Feuilles » (provenance).

import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Layers,
  Ruler,
  X,
  Hammer,
  Scissors,
  Package,
  Check,
} from "lucide-react";
import { useStock } from "@/hooks/useStock";
import type { User } from "@/types";
import {
  StockSheet,
  StockPiece,
  StockNature,
  PieceEtat,
  STOCK_NATURES,
  EPAISSEUR_OPTIONS,
  generateSheetName,
  pieceLabel,
  natureLabel,
  parseCm,
} from "@/types/stock";
import { evaluateFabrication, type ProductType } from "@/lib/fabrication";

const fmtTime = (iso: string): string => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });
};

interface FlatPiece {
  piece: StockPiece;
  sheet: StockSheet;
}

const NATURE_FILTERS: (StockNature | "toutes")[] = ["toutes", "vitre", "plexiglass", "miroir"];

// ── Ligne pièce (toggle 1-tap + diviser + supprimer) ─────────

const PieceRow: React.FC<{
  flat: FlatPiece;
  onToggle: () => void;
  onDivide: () => void;
  onDelete: () => void;
}> = ({ flat, onToggle, onDivide, onDelete }) => {
  const { piece, sheet } = flat;
  const dispo = piece.etat === "disponible";
  return (
    <div
      onClick={onToggle}
      className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
        dispo ? "bg-white border-gray-200 hover:border-emerald-300" : "bg-gray-50 border-gray-100 opacity-75"
      }`}
    >
      <span
        className="w-3 h-3 rounded-full shrink-0"
        style={{ background: dispo ? "#10b981" : "#9ca3af" }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`text-sm font-medium ${dispo ? "text-gray-800" : "text-gray-400 line-through"}`}>
            {natureLabel(piece.nature)} {piece.largeur}×{piece.hauteur}
          </span>
          {piece.quantite > 1 && (
            <span className="text-xs font-semibold text-gray-400">×{piece.quantite}</span>
          )}
        </div>
        <span className="block text-[11px] text-gray-400 truncate">
          {sheet.nom || "Feuille"} · {fmtTime(sheet.created_at)}
          {sheet.epaisseur ? ` · ${sheet.epaisseur}` : ""}
        </span>
      </div>

      <span
        className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full ${
          dispo ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
        }`}
      >
        {dispo ? "Disponible" : "Utilisé"}
      </span>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDivide();
        }}
        title="Diviser en plusieurs pièces"
        className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50"
      >
        <Scissors className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        title="Supprimer"
        className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
};

// ── Bandeau fabriquable ──────────────────────────────────────

const PRODUCT_META: Record<ProductType, { label: string; color: string }> = {
  table_verre: { label: "Tables en verre", color: "bg-sky-100 text-sky-700 border-sky-200" },
  table_bois: { label: "Tables en bois", color: "bg-amber-100 text-amber-700 border-amber-200" },
  tableau: { label: "Tableaux", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
};

const FabriquableBandeau: React.FC<{
  result: ReturnType<typeof evaluateFabrication>;
  onToggle: () => void;
  open: boolean;
}> = ({ result, onToggle, open }) => {
  const parts: string[] = [];
  (["table_verre", "table_bois", "tableau"] as ProductType[]).forEach((t) => {
    if (result.counts[t] > 0) parts.push(`${result.counts[t]} ${PRODUCT_META[t].label.toLowerCase()}`);
  });
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full text-left p-3.5 rounded-xl bg-gradient-to-r from-sky-500 to-emerald-400 text-white shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-center gap-2.5">
        <Hammer className="h-5 w-5 shrink-0" />
        <span className="text-sm font-semibold">
          Fabriquable : {parts.length ? parts.join(" · ") : "aucun produit complet"}
        </span>
        <span className="ml-auto text-xs opacity-90">{open ? "Réduire" : "Voir"}</span>
      </div>
    </button>
  );
};

const FabricationDetail: React.FC<{ result: ReturnType<typeof evaluateFabrication> }> = ({
  result,
}) => {
  const order = ["table_verre", "table_bois", "tableau"] as ProductType[];
  return (
    <div className="space-y-4">
      {/* Produits complets */}
      {order.map((t) => {
        const items = result.products.filter((p) => p.type === t);
        if (items.length === 0) return null;
        return (
          <div key={t}>
            <h4 className="text-xs font-semibold text-gray-600 mb-1.5">{PRODUCT_META[t].label}</h4>
            <div className="space-y-1.5">
              {items.map((p, idx) => (
                <div key={idx} className="bg-white rounded-lg border border-gray-200 p-2.5">
                  <span className="text-[11px] font-semibold text-gray-500">
                    {PRODUCT_META[t].label.replace(/s$/, "")} #{idx + 1}
                  </span>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {p.pieces.map((s) => (
                      <span
                        key={s.id}
                        className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border border-gray-200 bg-gray-50 text-gray-700"
                      >
                        {natureLabel(s.nature)} {s.largeur}×{s.hauteur}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Diagnostic quasi-complet */}
      {result.diagnostics.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-amber-600 mb-1.5">
            ⚠️ Presque complet — à recouper ou manquant
          </h4>
          <div className="space-y-1.5">
            {result.diagnostics.map((d, i) => (
              <div key={i} className="bg-white rounded-lg border border-amber-200 p-2.5">
                <span className="text-[11px] font-semibold text-gray-700">{d.label}</span>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {d.present.map((s) => (
                    <span
                      key={s.id}
                      className="text-[11px] px-2 py-0.5 rounded-md border border-gray-200 bg-gray-50 text-gray-700"
                    >
                      {natureLabel(s.nature)} {s.largeur}×{s.hauteur}
                    </span>
                  ))}
                  {d.problematic.map((p) => (
                    <span
                      key={p.piece.id}
                      className="text-[11px] px-2 py-0.5 rounded-md border-2 border-dashed border-amber-400 bg-amber-50 text-amber-700"
                    >
                      {natureLabel(p.piece.nature)} {p.piece.largeur}×{p.piece.hauteur} → recouper à{" "}
                      {p.requiredLargeur}×{p.requiredHauteur}
                    </span>
                  ))}
                  {d.missing.map((m, mi) => (
                    <span
                      key={`${m.nom}-${mi}`}
                      className="text-[11px] px-2 py-0.5 rounded-md border-2 border-dashed border-gray-300 bg-gray-50 text-gray-500"
                    >
                      manque : {natureLabel(m.nature)} {m.largeur}×{m.hauteur}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pièces restantes */}
      {result.leftover.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 mb-1.5">
            Pièces restantes ({result.leftover.length})
          </h4>
          <div className="flex flex-wrap gap-1">
            {result.leftover.map((s) => (
              <span
                key={s.id}
                className="text-[11px] px-2 py-0.5 rounded-md border border-gray-200 bg-white text-gray-500"
              >
                {natureLabel(s.nature)} {s.largeur}×{s.hauteur}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Dialogue feuille (ajout / édition) ───────────────────────

const AddSheetDialog: React.FC<{
  sheet?: StockSheet | null;
  onClose: () => void;
  onSave: (input: import("@/types/stock").StockSheetInput) => Promise<void>;
}> = ({ sheet, onClose, onSave }) => {
  const isEdit = !!sheet;
  const [nature, setNature] = useState<StockNature>(sheet?.nature ?? "vitre");
  const [epaisseur, setEpaisseur] = useState(sheet?.epaisseur ?? "");
  const [longueur, setLongueur] = useState(sheet?.longueur != null ? String(sheet.longueur) : "");
  const [largeur, setLargeur] = useState(sheet?.largeur != null ? String(sheet.largeur) : "");
  const [pieces, setPieces] = useState<StockPiece[]>(sheet?.pieces ?? []);
  const [saving, setSaving] = useState(false);

  const addPiece = () => {
    setPieces((prev) => [
      ...prev,
      { id: crypto.randomUUID(), nature, largeur: 0, hauteur: 0, quantite: 1, etat: "disponible" },
    ]);
  };

  const updatePiece = (id: string, patch: Partial<StockPiece>) => {
    setPieces((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const removePiece = (id: string) => setPieces((prev) => prev.filter((p) => p.id !== id));

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const L = parseCm(longueur);
      const l = parseCm(largeur);
      const validPieces = pieces
        .filter((p) => p.largeur > 0 && p.hauteur > 0)
        .map((p) => ({ ...p, nature, quantite: Math.max(1, p.quantite || 1) }));
      await onSave({
        nature,
        nom: generateSheetName(L, l),
        longueur: L,
        largeur: l,
        epaisseur: epaisseur || null,
        pieces: validPieces,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const numInput = (value: string, setValue: (v: string) => void, placeholder: string) => (
    <input
      type="text"
      inputMode="decimal"
      value={value}
      onChange={(e) => setValue(e.target.value.replace(/[^\d.,]/g, ""))}
      placeholder={placeholder}
      className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm text-gray-800 bg-white focus:ring-2 focus:ring-sky-500/40 focus:border-sky-400 outline-none"
    />
  );

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <h3 className="text-base font-semibold text-gray-800">
            {isEdit ? "Modifier la feuille" : "Ajouter une feuille"}
          </h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Nature */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Nature</label>
            <div className="flex gap-1.5">
              {STOCK_NATURES.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setNature(n.id)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    nature === n.id
                      ? "border-sky-500 bg-sky-50 text-sky-700 ring-1 ring-sky-300"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {n.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dimensions + épaisseur */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Dimensions (cm)</label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="block text-[11px] text-gray-400 mb-1">Longueur (L)</span>
                {numInput(longueur, setLongueur, "L")}
              </div>
              <div>
                <span className="block text-[11px] text-gray-400 mb-1">Largeur (l)</span>
                {numInput(largeur, setLargeur, "l")}
              </div>
              <div>
                <span className="block text-[11px] text-gray-400 mb-1">Épaisseur</span>
                <select
                  value={epaisseur}
                  onChange={(e) => setEpaisseur(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm text-gray-800 bg-white focus:ring-2 focus:ring-sky-500/40 focus:border-sky-400 outline-none"
                >
                  <option value="">—</option>
                  {EPAISSEUR_OPTIONS.map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Pièces */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-500">Pièces (découpes)</label>
              <button
                type="button"
                onClick={addPiece}
                className="inline-flex items-center gap-1 text-xs font-medium text-sky-600 hover:text-sky-700"
              >
                <Plus className="h-3.5 w-3.5" /> Ajouter une pièce
              </button>
            </div>

            {pieces.length === 0 && (
              <p className="text-xs text-gray-400 italic py-1">
                Aucune pièce. Ajoutez les découpes de cette feuille.
              </p>
            )}

            <div className="space-y-2">
              {pieces.map((p) => (
                <div key={p.id} className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 bg-gray-50/60">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={p.largeur || ""}
                    onChange={(e) =>
                      updatePiece(p.id, { largeur: Number(e.target.value.replace(/[^\d.,]/g, "").replace(",", ".")) || 0 })
                    }
                    placeholder="L"
                    className="w-20 h-9 px-2 rounded-md border border-gray-300 text-sm bg-white text-center focus:ring-2 focus:ring-sky-500/40 outline-none"
                  />
                  <span className="text-gray-400 text-xs">×</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={p.hauteur || ""}
                    onChange={(e) =>
                      updatePiece(p.id, { hauteur: Number(e.target.value.replace(/[^\d.,]/g, "").replace(",", ".")) || 0 })
                    }
                    placeholder="l"
                    className="w-20 h-9 px-2 rounded-md border border-gray-300 text-sm bg-white text-center focus:ring-2 focus:ring-sky-500/40 outline-none"
                  />
                  <span className="text-gray-400 text-xs">×</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={p.quantite || 1}
                    onChange={(e) =>
                      updatePiece(p.id, { quantite: Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1) })
                    }
                    placeholder="Qté"
                    title="Quantité"
                    className="w-14 h-9 px-2 rounded-md border border-gray-300 text-sm bg-white text-center focus:ring-2 focus:ring-sky-500/40 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => removePiece(p.id)}
                    className="ml-auto p-1.5 rounded-md text-gray-400 hover:text-red-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-gray-100 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-10 rounded-xl border border-gray-200 text-sm text-gray-600 font-medium hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 h-10 rounded-xl bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 disabled:opacity-60"
          >
            {saving ? "Enregistrement…" : isEdit ? "Enregistrer" : "Ajouter"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Modale diviser une pièce ─────────────────────────────────

const DivideModal: React.FC<{
  flat: FlatPiece;
  onConfirm: (subPieces: StockPiece[]) => void;
  onClose: () => void;
}> = ({ flat, onConfirm, onClose }) => {
  const [subs, setSubs] = useState<StockPiece[]>(
    flat.piece.quantite > 1
      ? [{ ...flat.piece, quantite: 1, id: crypto.randomUUID() }]
      : [
          { id: crypto.randomUUID(), nature: flat.piece.nature, largeur: 0, hauteur: 0, quantite: 1, etat: flat.piece.etat },
          { id: crypto.randomUUID(), nature: flat.piece.nature, largeur: 0, hauteur: 0, quantite: 1, etat: flat.piece.etat },
        ],
  );

  const updateSub = (id: string, patch: Partial<StockPiece>) =>
    setSubs((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const addSub = () =>
    setSubs((prev) => [
      ...prev,
      { id: crypto.randomUUID(), nature: flat.piece.nature, largeur: 0, hauteur: 0, quantite: 1, etat: flat.piece.etat },
    ]);

  const removeSub = (id: string) => setSubs((prev) => prev.filter((s) => s.id !== id));

  const confirm = () => {
    const valid = subs.filter((s) => s.largeur > 0 && s.hauteur > 0);
    if (valid.length === 0) return;
    onConfirm(valid.map((s) => ({ ...s, nature: flat.piece.nature })));
  };

  return (
    <div
      className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <h3 className="text-base font-semibold text-gray-800">
            Diviser « {pieceLabel(flat.piece)} »
          </h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="text-xs text-gray-400 mb-3">
            Cette pièce sera remplacée par les sous-pièces ci-dessous (nature :{" "}
            {natureLabel(flat.piece.nature)}).
          </p>
          <div className="space-y-2">
            {subs.map((s) => (
              <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 bg-gray-50/60">
                <input
                  type="text"
                  inputMode="decimal"
                  value={s.largeur || ""}
                  onChange={(e) =>
                    updateSub(s.id, { largeur: Number(e.target.value.replace(/[^\d.,]/g, "").replace(",", ".")) || 0 })
                  }
                  placeholder="L"
                  className="w-20 h-9 px-2 rounded-md border border-gray-300 text-sm bg-white text-center focus:ring-2 focus:ring-violet-500/40 outline-none"
                />
                <span className="text-gray-400 text-xs">×</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={s.hauteur || ""}
                  onChange={(e) =>
                    updateSub(s.id, { hauteur: Number(e.target.value.replace(/[^\d.,]/g, "").replace(",", ".")) || 0 })
                  }
                  placeholder="l"
                  className="w-20 h-9 px-2 rounded-md border border-gray-300 text-sm bg-white text-center focus:ring-2 focus:ring-violet-500/40 outline-none"
                />
                <span className="text-gray-400 text-xs">×</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={s.quantite || 1}
                  onChange={(e) =>
                    updateSub(s.id, { quantite: Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1) })
                  }
                  placeholder="Qté"
                  className="w-14 h-9 px-2 rounded-md border border-gray-300 text-sm bg-white text-center focus:ring-2 focus:ring-violet-500/40 outline-none"
                />
                <button
                  type="button"
                  onClick={() => removeSub(s.id)}
                  className="ml-auto p-1.5 rounded-md text-gray-400 hover:text-red-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addSub}
            className="mt-3 w-full py-2 border-2 border-dashed border-violet-200 rounded-lg text-sm text-violet-500 hover:bg-violet-50 font-medium"
          >
            + Ajouter une sous-pièce
          </button>
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-gray-100 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-10 rounded-xl border border-gray-200 text-sm text-gray-600 font-medium hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={confirm}
            className="flex-1 h-10 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700"
          >
            Diviser
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Carte feuille (onglet Feuilles) ──────────────────────────

const SheetCard: React.FC<{
  sheet: StockSheet;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ sheet, onEdit, onDelete }) => {
  const dispo = sheet.pieces.filter((p) => p.etat === "disponible").length;
  const total = sheet.pieces.length;
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-gray-800">{sheet.nom || "Feuille"}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
              {natureLabel(sheet.nature)}
            </span>
            {sheet.epaisseur && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-50 text-gray-500 border border-gray-200">
                {sheet.epaisseur}
              </span>
            )}
          </div>
          <span className="block text-[11px] text-gray-400 mt-0.5">
            <Ruler className="h-3 w-3 inline mr-0.5" />
            {[sheet.longueur, sheet.largeur].filter((v) => v != null).join("×") || "—"} cm ·{" "}
            {fmtTime(sheet.created_at)}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onEdit} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100">
            <Ruler className="h-4 w-4" />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-gray-400">
        <Layers className="h-3.5 w-3.5" />
        {total} pièce{total > 1 ? "s" : ""}
        <span className="ml-auto text-emerald-600 font-medium">{dispo} disponible</span>
      </div>
    </div>
  );
};

// ── Page principale ──────────────────────────────────────────

const Stock: React.FC<{ user: User | null }> = ({ user }) => {
  const navigate = useNavigate();
  const { sheets, isLoading, createSheet, updateSheet, deleteSheet } = useStock();
  const [tab, setTab] = useState<"stock" | "feuilles">("stock");
  const [natureFilter, setNatureFilter] = useState<StockNature | "toutes">("toutes");
  const [fabOpen, setFabOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StockSheet | null>(null);
  const [deleteSheetId, setDeleteSheetId] = useState<string | null>(null);
  const [deletePieceTarget, setDeletePieceTarget] = useState<FlatPiece | null>(null);
  const [divideTarget, setDivideTarget] = useState<FlatPiece | null>(null);

  const allPieces = useMemo<FlatPiece[]>(
    () => sheets.flatMap((sh) => sh.pieces.map((piece) => ({ piece, sheet: sh }))),
    [sheets],
  );

  const filteredPieces = useMemo(
    () => (natureFilter === "toutes" ? allPieces : allPieces.filter((fp) => fp.piece.nature === natureFilter)),
    [allPieces, natureFilter],
  );

  const result = useMemo(() => evaluateFabrication(sheets), [sheets]);

  const dispoCount = allPieces.filter((fp) => fp.piece.etat === "disponible").reduce((s, fp) => s + fp.piece.quantite, 0);
  const utiliseCount = allPieces.filter((fp) => fp.piece.etat === "utilise").reduce((s, fp) => s + fp.piece.quantite, 0);

  const togglePiece = async (flat: FlatPiece) => {
    const newEtat: PieceEtat = flat.piece.etat === "disponible" ? "utilise" : "disponible";
    const pieces = flat.sheet.pieces.map((p) =>
      p.id === flat.piece.id ? { ...p, etat: newEtat } : p,
    );
    try {
      await updateSheet(flat.sheet.id, { pieces }, flat.sheet.updated_at);
    } catch {
      /* conflit géré par le hook */
    }
  };

  const dividePiece = async (flat: FlatPiece, subPieces: StockPiece[]) => {
    const pieces = flat.sheet.pieces.flatMap((p) => (p.id === flat.piece.id ? subPieces : [p]));
    try {
      await updateSheet(flat.sheet.id, { pieces }, flat.sheet.updated_at);
    } catch {
      /* conflit géré par le hook */
    }
    setDivideTarget(null);
  };

  const confirmDeletePiece = async () => {
    if (!deletePieceTarget) return;
    const pieces = deletePieceTarget.sheet.pieces.filter((p) => p.id !== deletePieceTarget.piece.id);
    try {
      await updateSheet(deletePieceTarget.sheet.id, { pieces }, deletePieceTarget.sheet.updated_at);
    } catch {
      /* conflit géré par le hook */
    }
    setDeletePieceTarget(null);
  };

  const confirmDeleteSheet = async () => {
    if (deleteSheetId) {
      await deleteSheet(deleteSheetId);
      setDeleteSheetId(null);
    }
  };

  const handleSave = async (input: import("@/types/stock").StockSheetInput) => {
    if (editing) {
      await updateSheet(editing.id, input, editing.updated_at);
    } else {
      await createSheet({
        ...input,
        created_by: user?.id ?? null,
        created_by_name: user?.name ?? null,
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50/40 via-white to-emerald-50/20">
      <div className="container mx-auto py-6 px-4 max-w-3xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl text-gray-500 hover:bg-white hover:text-gray-800 border border-transparent hover:border-gray-200 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-sky-500 to-emerald-400 p-2.5 rounded-2xl shadow-sm">
              <Package className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Stock</h1>
              <p className="text-sm text-gray-500">
                {dispoCount} pièce{dispoCount > 1 ? "s" : ""} disponible{dispoCount > 1 ? "s" : ""} ·{" "}
                {utiliseCount} utilisée{utiliseCount > 1 ? "s" : ""}
              </p>
            </div>
          </div>
          {tab === "feuilles" && (
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
              className="ml-auto inline-flex items-center gap-2 rounded-xl bg-gray-900 text-white px-4 py-2.5 text-sm font-medium shadow-sm hover:bg-gray-800 transition-colors"
            >
              <Plus className="h-4 w-4" /> Ajouter
            </button>
          )}
        </div>

        {/* Onglets */}
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setTab("stock")}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium border transition-all ${
              tab === "stock" ? "bg-gray-900 text-white border-gray-900 shadow-sm" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
            }`}
          >
            <Package className="h-4 w-4" /> Stock
          </button>
          <button
            type="button"
            onClick={() => setTab("feuilles")}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium border transition-all ${
              tab === "feuilles" ? "bg-gray-900 text-white border-gray-900 shadow-sm" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
            }`}
          >
            <Layers className="h-4 w-4" /> Feuilles
          </button>
        </div>

        {tab === "stock" ? (
          <>
            {/* Bandeau fabriquable */}
            <FabriquableBandeau result={result} open={fabOpen} onToggle={() => setFabOpen((v) => !v)} />

            {fabOpen && (
              <div className="mt-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                <FabricationDetail result={result} />
              </div>
            )}

            {/* Filtres nature */}
            <div className="flex gap-2 my-4 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {NATURE_FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setNatureFilter(f)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium border whitespace-nowrap transition-all ${
                    natureFilter === f
                      ? "bg-gray-900 text-white border-gray-900 shadow-sm"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {f === "toutes" ? "Toutes" : natureLabel(f)}
                </button>
              ))}
            </div>

            {/* Liste des pièces */}
            {isLoading ? (
              <p className="text-sm text-gray-400 text-center py-12">Chargement…</p>
            ) : filteredPieces.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-gray-300 rounded-2xl bg-white/50">
                <Package className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">Aucune pièce dans cette vue.</p>
                <button
                  type="button"
                  onClick={() => {
                    setTab("feuilles");
                    setEditing(null);
                    setDialogOpen(true);
                  }}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl border border-sky-300 text-sky-600 px-4 py-2 text-sm font-medium hover:bg-sky-50"
                >
                  <Plus className="h-4 w-4" /> Ajouter une feuille
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredPieces.map((fp) => (
                  <PieceRow
                    key={fp.piece.id}
                    flat={fp}
                    onToggle={() => togglePiece(fp)}
                    onDivide={() => setDivideTarget(fp)}
                    onDelete={() => setDeletePieceTarget(fp)}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {isLoading ? (
              <p className="text-sm text-gray-400 text-center py-12">Chargement…</p>
            ) : sheets.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-gray-300 rounded-2xl bg-white/50">
                <Layers className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">Aucune feuille.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sheets.map((sh) => (
                  <SheetCard
                    key={sh.id}
                    sheet={sh}
                    onEdit={() => {
                      setEditing(sh);
                      setDialogOpen(true);
                    }}
                    onDelete={() => setDeleteSheetId(sh.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Dialogue feuille */}
      {dialogOpen && (
        <AddSheetDialog
          sheet={editing}
          onClose={() => setDialogOpen(false)}
          onSave={handleSave}
        />
      )}

      {/* Modale diviser */}
      {divideTarget && (
        <DivideModal
          flat={divideTarget}
          onConfirm={(subs) => dividePiece(divideTarget, subs)}
          onClose={() => setDivideTarget(null)}
        />
      )}

      {/* Confirmation suppression pièce */}
      {deletePieceTarget && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setDeletePieceTarget(null)}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-800 mb-2">Supprimer la pièce ?</h3>
            <p className="text-sm text-gray-500 mb-4">
              {pieceLabel(deletePieceTarget.piece)} sera retirée de la feuille.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeletePieceTarget(null)}
                className="flex-1 h-10 rounded-xl border border-gray-200 text-sm text-gray-600 font-medium hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmDeletePiece}
                className="flex-1 h-10 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation suppression feuille */}
      {deleteSheetId && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setDeleteSheetId(null)}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-800 mb-2">Supprimer la feuille ?</h3>
            <p className="text-sm text-gray-500 mb-4">
              Cette feuille et toutes ses pièces seront définitivement supprimées.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteSheetId(null)}
                className="flex-1 h-10 rounded-xl border border-gray-200 text-sm text-gray-600 font-medium hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmDeleteSheet}
                className="flex-1 h-10 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Stock;
