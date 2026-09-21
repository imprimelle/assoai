// src/pages/Stock.tsx
// Page Stock — gestion logistique des matériaux de découpe (vitre, plexiglass, miroir).
// 2 vues : « Feuilles » (stock) et « Fabrication » (évaluation unifiée des produits fabriquables).

import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Layers,
  Ruler,
  X,
  History,
  Check,
  Hammer,
  Pencil,
} from "lucide-react";
import { useStock } from "@/hooks/useStock";
import type { User } from "@/types";
import {
  StockSheet,
  StockSection,
  StockNature,
  StockHistoryEvent,
  SectionStatut,
  STOCK_NATURES,
  EPAISSEUR_OPTIONS,
  SECTION_STATUTS,
  generateSheetName,
  autoSectionName,
  typeLabel,
  natureLabel,
  statutLabel,
  parseCm,
} from "@/types/stock";
import { evaluateFabrication } from "@/lib/fabrication";

const fmtTime = (iso: string): string => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/** Met à jour une section (par id, récursivement dans les sous-sections). */
function updateSectionRecursive(
  sections: StockSection[],
  sectionId: string,
  patch: Partial<StockSection>,
): StockSection[] {
  return sections.map((s) => {
    if (s.id === sectionId) return { ...s, ...patch };
    if (s.sub_sections) {
      return { ...s, sub_sections: updateSectionRecursive(s.sub_sections, sectionId, patch) };
    }
    return s;
  });
}

// ── Légende des statuts ──────────────────────────────────────

const StatutLegend: React.FC = () => (
  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mb-4">
    <span className="font-medium text-gray-400">Statuts :</span>
    {SECTION_STATUTS.map((s) => (
      <span
        key={s.id}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${s.badge}`}
      >
        <span className="w-2 h-2 rounded-full" style={{ background: s.fill }} />
        {s.label}
      </span>
    ))}
    <span className="ml-1 text-gray-400">· cliquer sur une section pour poser son statut</span>
  </div>
);

// ── Figure d'une section ─────────────────────────────────────

const SectionFigure: React.FC<{
  section: StockSection;
  onSelect: () => void;
}> = ({ section, onSelect }) => {
  const statut = SECTION_STATUTS.find((s) => s.id === section.statut);
  const nature = STOCK_NATURES.find((n) => n.id === section.nature);

  const maxW = 120;
  const maxH = 78;
  const ratio = section.hauteur > 0 ? section.largeur / section.hauteur : 1;
  let w = maxW;
  let h = maxW / ratio;
  if (h > maxH) {
    h = maxH;
    w = maxH * ratio;
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      title={`${section.nom} — ${statut?.label}. Cliquer pour changer.`}
      className="relative flex flex-col items-center gap-1 p-2 rounded-xl bg-white border border-gray-100 hover:border-gray-300 hover:shadow-sm transition-all active:scale-95 cursor-pointer"
    >
      {/* Badge quantité */}
      {section.quantite && section.quantite > 1 && (
        <span className="absolute -top-1.5 -left-1.5 z-10 text-[9px] px-1.5 py-0.5 rounded-full bg-gray-900 text-white font-bold shadow-sm">
          ×{section.quantite}
        </span>
      )}

      {/* Badge statut */}
      <span
        className={`absolute -top-1.5 -right-1.5 z-10 text-[9px] px-1.5 py-0.5 rounded-full border font-semibold ${statut?.badge}`}
      >
        {statut?.label}
      </span>

      <div
        className="flex items-center justify-center rounded-md border"
        style={{
          width: `${w}px`,
          height: `${h}px`,
          background: nature?.tint || "transparent",
          borderColor: statut?.fill,
        }}
      >
        {/* Dimensions à l'intérieur */}
        <span className="px-1 text-[10px] font-semibold text-gray-700 leading-tight text-center">
          {section.largeur}×{section.hauteur}
        </span>
      </div>
      <span className="text-[10px] text-gray-400 text-center leading-tight">
        {natureLabel(section.nature)}
      </span>
    </button>
  );
};

// ── Carte feuille ────────────────────────────────────────────

const dimsLabel = (sheet: StockSheet): string => {
  const parts: string[] = [];
  if (sheet.longueur != null) parts.push(`L ${sheet.longueur}`);
  if (sheet.largeur != null) parts.push(`l ${sheet.largeur}`);
  if (sheet.hauteur != null) parts.push(`h ${sheet.hauteur}`);
  return parts.length ? `${parts.join(" × ")} cm` : "—";
};

const SheetCard: React.FC<{
  sheet: StockSheet;
  onSelectStatut: (section: StockSection) => void;
  onDivide: (section: StockSection) => void;
  onUnDivide: (section: StockSection) => void;
  onDelete: () => void;
  onEdit: () => void;
}> = ({ sheet, onSelectStatut, onDivide, onUnDivide, onDelete, onEdit }) => {
  const nature = STOCK_NATURES.find((n) => n.id === sheet.nature);
  const used = sheet.sections.filter((s) => s.statut === "utilise").length;
  const [showHistory, setShowHistory] = useState(false);
  const history = sheet.section_history || [];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-gray-100">
        <button type="button" onClick={onEdit} className="text-left min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-gray-800 truncate">
              {sheet.nom || typeLabel(sheet.type)}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
              {typeLabel(sheet.type)}
            </span>
            {nature && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                {nature.label}
              </span>
            )}
            {sheet.epaisseur && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-50 text-gray-500 font-medium border border-gray-200">
                {sheet.epaisseur}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-400">
            <Ruler className="h-3 w-3" />
            {dimsLabel(sheet)}
          </div>
        </button>
        <button
          type="button"
          onClick={onDelete}
          title="Supprimer"
          className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Sections */}
      <div className="px-4 py-3">
        {sheet.sections.length === 0 ? (
          <p className="text-xs text-gray-400 italic py-2">Aucune section définie.</p>
        ) : (
          <>
            <div className="flex items-center gap-1.5 mb-2 text-[11px] text-gray-400">
              <Layers className="h-3.5 w-3.5" />
              {sheet.sections.length} section{sheet.sections.length > 1 ? "s" : ""}
              <span className="ml-auto">
                {used}/{sheet.sections.length} utilisé{sheet.sections.length > 1 ? "s" : ""}
              </span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {sheet.sections.map((s) =>
                s.statut === "divise" && s.sub_sections?.length ? (
                  <div
                    key={s.id}
                    className="col-span-full rounded-xl border border-violet-200 bg-violet-50/40 p-2"
                  >
                    <div className="flex items-center gap-1.5 mb-2">
                      <button
                        type="button"
                        onClick={() => onDivide(s)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-violet-600 hover:text-violet-700"
                      >
                        <Pencil className="h-3 w-3" /> Divisé · {s.sub_sections.length}
                      </button>
                      <button
                        type="button"
                        onClick={() => onUnDivide(s)}
                        title="Dé-diviser"
                        className="ml-auto p-1 rounded-md text-violet-400 hover:text-violet-600 hover:bg-violet-100"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                      {s.sub_sections.map((sub) => (
                        <SectionFigure
                          key={sub.id}
                          section={sub}
                          onSelect={() => onSelectStatut(sub)}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <SectionFigure
                    key={s.id}
                    section={s}
                    onSelect={() => onSelectStatut(s)}
                  />
                ),
              )}
            </div>
          </>
        )}
      </div>

      {/* Audit + historique */}
      <div className="px-4 py-2 border-t border-gray-100 bg-gray-50/50 text-[11px] text-gray-400">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span>
            Créé par {sheet.created_by_name || "—"}
            {sheet.created_at ? ` · ${fmtTime(sheet.created_at)}` : ""}
          </span>
          {history.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="ml-auto inline-flex items-center gap-1 text-gray-500 hover:text-gray-700"
            >
              <History className="h-3 w-3" />
              {history.length} changement{history.length > 1 ? "s" : ""}
            </button>
          )}
        </div>

        {showHistory && history.length > 0 && (
          <ul className="mt-2 space-y-1 max-h-32 overflow-y-auto">
            {[...history].reverse().map((ev, i) => (
              <li key={i} className="flex items-center gap-1.5 text-gray-500">
                <span className="font-medium text-gray-600">{ev.sectionNom}</span>
                <span>{statutLabel(ev.from)}</span>
                <span>→</span>
                <span className="font-medium">{statutLabel(ev.to)}</span>
                <span className="ml-auto text-gray-400">
                  {ev.byName} · {fmtTime(ev.ts)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

// ── Sélecteur de statut (modal) ──────────────────────────────

const StatutPicker: React.FC<{
  section: StockSection;
  onPick: (statut: SectionStatut) => void;
  onClose: () => void;
}> = ({ section, onPick, onClose }) => {
  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-semibold text-gray-800">Statut de la section</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          {section.nom} · {section.largeur}×{section.hauteur} cm · {natureLabel(section.nature)}
        </p>
        <div className="space-y-2">
          {SECTION_STATUTS.map((s) => {
            const active = section.statut === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onPick(s.id)}
                className={`flex items-center justify-between w-full px-4 py-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                  active
                    ? "border-gray-900 bg-gray-50 text-gray-900"
                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ background: s.fill }} />
                  {s.label}
                </span>
                {active && <Check className="h-4 w-4 text-gray-900" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ── Modale de subdivision (Divisé) ───────────────────────────

const SubDivisionModal: React.FC<{
  section: StockSection;
  onConfirm: (subSections: StockSection[]) => void;
  onClose: () => void;
}> = ({ section, onConfirm, onClose }) => {
  const [subs, setSubs] = useState<StockSection[]>(
    section.sub_sections && section.sub_sections.length
      ? section.sub_sections.map((s) => ({ ...s }))
      : [
          { id: crypto.randomUUID(), nom: "", nature: section.nature, largeur: 0, hauteur: 0, statut: "decoupe" },
          { id: crypto.randomUUID(), nom: "", nature: section.nature, largeur: 0, hauteur: 0, statut: "decoupe" },
        ],
  );

  const updateSub = (id: string, patch: Partial<StockSection>) => {
    setSubs((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const next = { ...s, ...patch };
        next.nom = autoSectionName(next.nature, next.largeur, next.hauteur);
        return next;
      }),
    );
  };

  const addSub = () => {
    setSubs((prev) => [
      ...prev,
      { id: crypto.randomUUID(), nom: "", nature: section.nature, largeur: 0, hauteur: 0, statut: "decoupe" },
    ]);
  };

  const removeSub = (id: string) => setSubs((prev) => prev.filter((s) => s.id !== id));

  const confirm = () => {
    const valid = subs.filter((s) => s.largeur > 0 && s.hauteur > 0);
    if (valid.length === 0) return;
    onConfirm(valid.map((s) => ({ ...s, nom: autoSectionName(s.nature, s.largeur, s.hauteur) })));
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
            Subdiviser « {section.nom || natureLabel(section.nature)} »
          </h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="text-xs text-gray-400 mb-3">
            Découpez cette section en sous-sections ({natureLabel(section.nature)}). Les noms sont générés automatiquement.
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
                <span className="flex-1 min-w-0 text-xs text-gray-400 truncate">
                  {s.largeur > 0 && s.hauteur > 0 ? autoSectionName(s.nature, s.largeur, s.hauteur) : "cm"}
                </span>
                <button
                  type="button"
                  onClick={() => removeSub(s.id)}
                  className="p-1.5 rounded-md text-gray-400 hover:text-red-600"
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
            + Ajouter une sous-section
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

// ── Dialogue ajout / édition d'une feuille ───────────────────

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
  const [sections, setSections] = useState<StockSection[]>(sheet?.sections ?? []);
  const [saving, setSaving] = useState(false);

  const addSection = () => {
    setSections((prev) => [
      ...prev,
      { id: crypto.randomUUID(), nom: "", nature, largeur: 0, hauteur: 0, quantite: 1, statut: "decoupe" },
    ]);
  };

  const updateSection = (id: string, patch: Partial<StockSection>) => {
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const next = { ...s, ...patch };
        next.nom = autoSectionName(nature, next.largeur, next.hauteur);
        return next;
      }),
    );
  };

  const removeSection = (id: string) =>
    setSections((prev) => prev.filter((s) => s.id !== id));

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const L = parseCm(longueur);
      const l = parseCm(largeur);
      const validSections = sections
        .filter((s) => s.largeur > 0 && s.hauteur > 0)
        .map((s) => ({
          ...s,
          nature,
          quantite: Math.max(1, s.quantite || 1),
          nom: autoSectionName(nature, s.largeur, s.hauteur),
        }));
      await onSave({
        type: "feuille",
        nature,
        nom: generateSheetName("feuille", L, l, null),
        longueur: L,
        largeur: l,
        hauteur: null,
        epaisseur: epaisseur || null,
        sections: validSections,
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

          {/* Dimensions + épaisseur (même ligne) */}
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

          {/* Sections */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-500">Sections (découpes)</label>
              <button
                type="button"
                onClick={addSection}
                className="inline-flex items-center gap-1 text-xs font-medium text-sky-600 hover:text-sky-700"
              >
                <Plus className="h-3.5 w-3.5" /> Ajouter une section
              </button>
            </div>

            {sections.length === 0 && (
              <p className="text-xs text-gray-400 italic py-1">
                Aucune section. Ajoutez les découpes de cette feuille.
              </p>
            )}

            <div className="space-y-2">
              {sections.map((s) => (
                <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 bg-gray-50/60">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={s.largeur || ""}
                    onChange={(e) =>
                      updateSection(s.id, { largeur: Number(e.target.value.replace(/[^\d.,]/g, "").replace(",", ".")) || 0 })
                    }
                    placeholder="L"
                    className="w-20 h-9 px-2 rounded-md border border-gray-300 text-sm bg-white text-center focus:ring-2 focus:ring-sky-500/40 outline-none"
                  />
                  <span className="text-gray-400 text-xs">×</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={s.hauteur || ""}
                    onChange={(e) =>
                      updateSection(s.id, { hauteur: Number(e.target.value.replace(/[^\d.,]/g, "").replace(",", ".")) || 0 })
                    }
                    placeholder="l"
                    className="w-20 h-9 px-2 rounded-md border border-gray-300 text-sm bg-white text-center focus:ring-2 focus:ring-sky-500/40 outline-none"
                  />
                  <span className="text-gray-400 text-xs">×</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={s.quantite || 1}
                    onChange={(e) =>
                      updateSection(s.id, { quantite: Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1) })
                    }
                    placeholder="Qté"
                    title="Quantité"
                    className="w-14 h-9 px-2 rounded-md border border-gray-300 text-sm bg-white text-center focus:ring-2 focus:ring-sky-500/40 outline-none"
                  />
                  <span className="flex-1 min-w-0 text-xs text-gray-400 truncate">
                    {s.largeur > 0 && s.hauteur > 0 ? autoSectionName(nature, s.largeur, s.hauteur) : "cm"}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeSection(s.id)}
                    className="p-1.5 rounded-md text-gray-400 hover:text-red-600"
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

// ── Vue Fabrication ──────────────────────────────────────────

const PRODUCT_META: Record<string, { label: string; color: string }> = {
  table_verre: { label: "Tables en verre", color: "bg-sky-100 text-sky-700 border-sky-200" },
  table_bois: { label: "Tables en bois", color: "bg-amber-100 text-amber-700 border-amber-200" },
  tableau: { label: "Tableaux", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
};

const FabricationView: React.FC<{ sheets: StockSheet[] }> = ({ sheets }) => {
  const result = useMemo(() => evaluateFabrication(sheets), [sheets]);
  const order = ["table_verre", "table_bois", "tableau"] as const;

  if (result.products.length === 0) {
    return (
      <div className="text-center py-12 border border-dashed border-gray-300 rounded-2xl bg-white/50">
        <Hammer className="h-10 w-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">
          Aucun produit fabulable avec le stock actuel.
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Assurez-vous d'avoir des sections « découpé » ou « raboté » dans les bonnes natures et dimensions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Synthèse */}
      <div className="flex flex-wrap gap-2">
        {order.map((t) => (
          <span
            key={t}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium ${PRODUCT_META[t].color}`}
          >
            {PRODUCT_META[t].label}
            <span className="bg-white/70 rounded-full px-1.5 text-xs font-bold">{result.counts[t]}</span>
          </span>
        ))}
      </div>

      {/* Produits fabulables, groupés par type */}
      {order.map((t) => {
        const items = result.products.filter((p) => p.type === t);
        if (items.length === 0) return null;
        return (
          <div key={t}>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">{PRODUCT_META[t].label}</h3>
            <div className="space-y-2">
              {items.map((p, idx) => (
                <div key={idx} className="bg-white rounded-xl border border-gray-200 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-500">
                      {PRODUCT_META[t].label.replace(/s$/, "")} #{idx + 1}
                    </span>
                    <span className="text-[10px] text-gray-400">{p.sections.length} sections</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {p.sections.map((s) => (
                      <span
                        key={s.id}
                        className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-gray-200 bg-gray-50 text-gray-700"
                      >
                        {s.nom}
                        <span className="text-gray-400">{s.largeur}×{s.hauteur}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Diagnostic : quasi-complet (à recouper / manquant) */}
      {result.diagnostics.length > 0 && (
        <div className="border-t border-gray-200 pt-4">
          <h3 className="text-sm font-semibold text-amber-600 mb-2">
            ⚠️ Presque complet ({result.diagnostics.length}) — à recouper ou manquant
          </h3>
          <div className="space-y-2">
            {result.diagnostics.map((d, i) => (
              <div key={i} className="bg-white rounded-xl border border-amber-200 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-gray-700">{d.label}</span>
                  <span className="text-[10px] text-gray-400">{d.present.length} pièces présentes</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {d.present.map((s) => (
                    <span
                      key={s.id}
                      className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-gray-200 bg-gray-50 text-gray-700"
                    >
                      {s.nom} <span className="text-gray-400">{s.largeur}×{s.hauteur}</span>
                    </span>
                  ))}
                  {d.problematic.map((p) => (
                    <span
                      key={p.section.id}
                      className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border-2 border-dashed border-amber-400 bg-amber-50 text-amber-700"
                    >
                      {p.section.nom} {p.section.largeur}×{p.section.hauteur}
                      <span className="font-semibold">→ recouper à {p.requiredLargeur}×{p.requiredHauteur}</span>
                    </span>
                  ))}
                  {d.missing.map((m, mi) => (
                    <span
                      key={`${m.nom}-${mi}`}
                      className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border-2 border-dashed border-gray-300 bg-gray-50 text-gray-500"
                    >
                      manque : {m.nom} {m.largeur}×{m.hauteur}
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
        <div className="border-t border-gray-200 pt-4">
          <h3 className="text-sm font-semibold text-gray-500 mb-2">
            Pièces restantes ({result.leftover.length}) — insuffisantes pour un produit complet
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {result.leftover.map((s) => (
              <span
                key={s.id}
                className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-gray-200 bg-white text-gray-500"
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

// ── Page principale ──────────────────────────────────────────

const Stock: React.FC<{ user: User | null }> = ({ user }) => {
  const navigate = useNavigate();
  const { sheets, isLoading, createSheet, updateSheet, deleteSheet } = useStock();
  const [view, setView] = useState<"feuilles" | "fabrication">("feuilles");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StockSheet | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [statutTarget, setStatutTarget] = useState<StockSheet | null>(null);
  const [statutSection, setStatutSection] = useState<StockSection | null>(null);
  const [subDivTarget, setSubDivTarget] = useState<StockSheet | null>(null);
  const [subDivSection, setSubDivSection] = useState<StockSection | null>(null);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (sheet: StockSheet) => {
    setEditing(sheet);
    setDialogOpen(true);
  };

  const handleSave = async (input: import("@/types/stock").StockSheetInput) => {
    if (editing) {
      await updateSheet(editing.id, input, editing.updated_at);
    } else {
      await createSheet({
        ...input,
        created_by: user?.id ?? null,
        created_by_name: user?.name ?? null,
        section_history: [],
      });
    }
  };

  const openStatutPicker = (sheet: StockSheet, section: StockSection) => {
    setStatutTarget(sheet);
    setStatutSection(section);
  };

  const handlePickStatut = async (newStatut: SectionStatut) => {
    if (!statutTarget || !statutSection) return;
    const sheet = statutTarget;
    const section = statutSection;

    if (newStatut === "divise") {
      setSubDivTarget(sheet);
      setSubDivSection(section);
      setStatutTarget(null);
      setStatutSection(null);
      return;
    }

    if (section.statut !== newStatut) {
      const sections = updateSectionRecursive(sheet.sections, section.id, { statut: newStatut });
      const event: StockHistoryEvent = {
        ts: new Date().toISOString(),
        sectionId: section.id,
        sectionNom: section.nom || "Sans nom",
        from: section.statut,
        to: newStatut,
        byName: user?.name || "—",
      };
      const section_history = [...(sheet.section_history || []), event];
      try {
        await updateSheet(sheet.id, { sections, section_history }, sheet.updated_at);
      } catch {
        /* conflit géré par le hook */
      }
    }
    setStatutTarget(null);
    setStatutSection(null);
  };

  const handleConfirmSubDivision = async (subSections: StockSection[]) => {
    if (!subDivTarget || !subDivSection) return;
    const sheet = subDivTarget;
    const section = subDivSection;
    const sections = updateSectionRecursive(sheet.sections, section.id, {
      statut: "divise",
      sub_sections: subSections,
    });
    const event: StockHistoryEvent = {
      ts: new Date().toISOString(),
      sectionId: section.id,
      sectionNom: section.nom || "Sans nom",
      from: section.statut,
      to: "divise",
      byName: user?.name || "—",
    };
    const section_history = [...(sheet.section_history || []), event];
    try {
      await updateSheet(sheet.id, { sections, section_history }, sheet.updated_at);
    } catch {
      /* conflit géré par le hook */
    }
    setSubDivTarget(null);
    setSubDivSection(null);
  };

  const handleUnDivide = async (sheet: StockSheet, section: StockSection) => {
    const sections = updateSectionRecursive(sheet.sections, section.id, {
      statut: "decoupe",
      sub_sections: undefined,
    });
    try {
      await updateSheet(sheet.id, { sections }, sheet.updated_at);
    } catch {
      /* conflit géré par le hook */
    }
  };

  const confirmDelete = async () => {
    if (deleteId) {
      await deleteSheet(deleteId);
      setDeleteId(null);
    }
  };

  const total = sheets.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50/40 via-white to-emerald-50/20">
      <div className="container mx-auto py-6 px-4 max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl text-gray-500 hover:bg-white hover:text-gray-800 border border-transparent hover:border-gray-200 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-sky-500 to-emerald-400 p-2.5 rounded-2xl shadow-sm">
              <Layers className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Stock</h1>
              <p className="text-sm text-gray-500">
                {total} feuille{total !== 1 ? "s" : ""} de matière · découpe
              </p>
            </div>
          </div>
          {view === "feuilles" && (
            <button
              type="button"
              onClick={openCreate}
              className="ml-auto inline-flex items-center gap-2 rounded-xl bg-gray-900 text-white px-4 py-2.5 text-sm font-medium shadow-sm hover:bg-gray-800 transition-colors"
            >
              <Plus className="h-4 w-4" /> Ajouter
            </button>
          )}
        </div>

        {/* Onglets */}
        <div className="flex gap-2 mb-5">
          <button
            type="button"
            onClick={() => setView("feuilles")}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium border transition-all ${
              view === "feuilles"
                ? "bg-gray-900 text-white border-gray-900 shadow-sm"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
            }`}
          >
            <Layers className="h-4 w-4" /> Feuilles
          </button>
          <button
            type="button"
            onClick={() => setView("fabrication")}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium border transition-all ${
              view === "fabrication"
                ? "bg-gray-900 text-white border-gray-900 shadow-sm"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
            }`}
          >
            <Hammer className="h-4 w-4" /> Fabrication
          </button>
        </div>

        {view === "feuilles" ? (
          <>
            <StatutLegend />

            {isLoading ? (
              <p className="text-sm text-gray-400 text-center py-12">Chargement…</p>
            ) : sheets.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-gray-300 rounded-2xl bg-white/50">
                <Layers className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">Aucune feuille en stock.</p>
                <button
                  type="button"
                  onClick={openCreate}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl border border-sky-300 text-sky-600 px-4 py-2 text-sm font-medium hover:bg-sky-50"
                >
                  <Plus className="h-4 w-4" /> Ajouter
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sheets.map((sheet) => (
                  <SheetCard
                    key={sheet.id}
                    sheet={sheet}
                    onSelectStatut={(section) => openStatutPicker(sheet, section)}
                    onDivide={(section) => {
                      setSubDivTarget(sheet);
                      setSubDivSection(section);
                    }}
                    onUnDivide={(section) => handleUnDivide(sheet, section)}
                    onDelete={() => setDeleteId(sheet.id)}
                    onEdit={() => openEdit(sheet)}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <FabricationView sheets={sheets} />
        )}
      </div>

      {/* Sélecteur de statut */}
      {statutTarget && statutSection && (
        <StatutPicker
          section={statutSection}
          onPick={handlePickStatut}
          onClose={() => {
            setStatutTarget(null);
            setStatutSection(null);
          }}
        />
      )}

      {/* Modale subdivision */}
      {subDivTarget && subDivSection && (
        <SubDivisionModal
          section={subDivSection}
          onConfirm={handleConfirmSubDivision}
          onClose={() => {
            setSubDivTarget(null);
            setSubDivSection(null);
          }}
        />
      )}

      {/* Dialogue ajout / édition */}
      {dialogOpen && (
        <AddSheetDialog
          sheet={editing}
          onClose={() => setDialogOpen(false)}
          onSave={handleSave}
        />
      )}

      {/* Confirmation suppression */}
      {deleteId && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setDeleteId(null)}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-800 mb-2">Confirmer la suppression</h3>
            <p className="text-sm text-gray-500 mb-4">
              Cet élément et ses sections seront définitivement supprimés du stock.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                className="flex-1 h-10 rounded-xl border border-gray-200 text-sm text-gray-600 font-medium hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmDelete}
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
