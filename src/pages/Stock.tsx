// src/pages/Stock.tsx
// Page Stock — gestion logistique des matériaux de découpe (vitre, plexiglass, miroir).
// 4 vues (Feuilles / Tables en verre / Tables en bois / Tableaux), sections découpées
// avec statuts découpé → raboté → utilisé.

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Layers, Ruler, X } from "lucide-react";
import { useStock, type StockSheetInput } from "@/hooks/useStock";
import {
  StockSheet,
  StockSection,
  StockType,
  StockNature,
  STOCK_TYPES,
  STOCK_NATURES,
  SECTION_STATUTS,
  STATUT_ORDER,
  nextStatut,
  generateSections,
  typeLabel,
  natureLabel,
} from "@/types/stock";

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
    <span className="ml-1 text-gray-400">· cliquer sur une section pour avancer</span>
  </div>
);

// ── Figure d'une section (rectangle proportionnel) ───────────

const SectionFigure: React.FC<{
  section: StockSection;
  onAdvance: () => void;
}> = ({ section, onAdvance }) => {
  const statut = SECTION_STATUTS.find((s) => s.id === section.statut);
  const nature = STOCK_NATURES.find((n) => n.id === section.nature);

  // Échelle pour tenir dans une boîte max, en préservant le ratio
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
      onClick={onAdvance}
      title={`${section.nom} — ${statut?.label}. Cliquer pour avancer.`}
      className="flex flex-col items-center gap-1 p-2 rounded-xl bg-white border border-gray-100 hover:border-gray-300 hover:shadow-sm transition-all active:scale-95"
    >
      <div
        className={`flex items-center justify-center rounded-md border-2 ${statut?.border}`}
        style={{
          width: `${w}px`,
          height: `${h}px`,
          background: nature?.tint || "transparent",
        }}
      >
        <span className="px-1 text-[9px] font-semibold text-gray-600 leading-tight text-center">
          {statut?.label}
        </span>
      </div>
      <span className="text-[11px] font-semibold text-gray-700 leading-tight text-center">
        {section.nom}
      </span>
      <span className="text-[10px] text-gray-400">
        {natureLabel(section.nature)} · {section.largeur}×{section.hauteur} cm
      </span>
    </button>
  );
};

// ── Carte feuille ────────────────────────────────────────────

const dimsLabel = (sheet: StockSheet): string => {
  const parts: string[] = [];
  if (sheet.largeur != null) parts.push(`L ${sheet.largeur}`);
  if (sheet.hauteur != null) parts.push(`l ${sheet.hauteur}`);
  if (sheet.profondeur != null) parts.push(`h ${sheet.profondeur}`);
  return parts.length ? `${parts.join(" × ")} cm` : "—";
};

const SheetCard: React.FC<{
  sheet: StockSheet;
  onAdvance: (sectionId: string) => void;
  onDelete: () => void;
  onEdit: () => void;
}> = ({ sheet, onAdvance, onDelete, onEdit }) => {
  const nature = STOCK_NATURES.find((n) => n.id === sheet.nature);
  const used = sheet.sections.filter((s) => s.statut === "utilise").length;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-gray-100">
        <button type="button" onClick={onEdit} className="text-left min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-gray-800 truncate">
              {sheet.nom || `${typeLabel(sheet.type)}`}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
              {typeLabel(sheet.type)}
            </span>
            {nature && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                {nature.label}
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
          <p className="text-xs text-gray-400 italic py-2">
            Aucune section définie.
          </p>
        ) : (
          <>
            <div className="flex items-center gap-1.5 mb-2 text-[11px] text-gray-400">
              <Layers className="h-3.5 w-3.5" />
              {sheet.sections.length} section{sheet.sections.length > 1 ? "s" : ""}
              {sheet.sections.length > 0 && (
                <span className="ml-auto">
                  {used}/{sheet.sections.length} utilisé{sheet.sections.length > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {sheet.sections.map((s) => (
                <SectionFigure
                  key={s.id}
                  section={s}
                  onAdvance={() => onAdvance(s.id)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ── Dialogue ajout / édition ─────────────────────────────────

const AddSheetDialog: React.FC<{
  sheet?: StockSheet | null;
  onClose: () => void;
  onSave: (input: StockSheetInput) => Promise<void>;
}> = ({ sheet, onClose, onSave }) => {
  const isEdit = !!sheet;
  const [type, setType] = useState<StockType>(sheet?.type ?? "feuille");
  const [nature, setNature] = useState<StockNature>(sheet?.nature ?? "vitre");
  const [nom, setNom] = useState(sheet?.nom ?? "");
  const [largeur, setLargeur] = useState(
    sheet?.largeur != null ? String(sheet.largeur) : "",
  );
  const [hauteur, setHauteur] = useState(
    sheet?.hauteur != null ? String(sheet.hauteur) : "",
  );
  const [profondeur, setProfondeur] = useState(
    sheet?.profondeur != null ? String(sheet.profondeur) : "",
  );
  const [manualSections, setManualSections] = useState<StockSection[]>(
    sheet?.type === "feuille" ? sheet.sections : [],
  );
  const [saving, setSaving] = useState(false);

  const typeDef = STOCK_TYPES.find((t) => t.id === type)!;
  const needs = (f: "largeur" | "hauteur" | "profondeur") =>
    typeDef.fields.includes(f);

  // Prévisualisation auto pour les types table/tableau
  const preview = useMemo(() => {
    if (type === "feuille") return [];
    const L = parseFloat(largeur) || 0;
    const l = parseFloat(hauteur) || 0;
    const h = parseFloat(profondeur) || 0;
    return generateSections(type, L, l, h);
  }, [type, largeur, hauteur, profondeur]);

  // Changement de type → reset des sections manuelles
  const handleTypeChange = (t: StockType) => {
    setType(t);
    if (t === "feuille") {
      setManualSections((prev) => (isEdit && sheet?.type === "feuille" ? prev : []));
    }
  };

  const addManualSection = () => {
    setManualSections((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        nom: "",
        nature,
        largeur: 0,
        hauteur: 0,
        statut: "decoupe",
      },
    ]);
  };

  const updateManualSection = (
    id: string,
    patch: Partial<StockSection>,
  ) => {
    setManualSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    );
  };

  const removeManualSection = (id: string) => {
    setManualSections((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const L = parseFloat(largeur) || null;
      const l = parseFloat(hauteur) || null;
      const h = parseFloat(profondeur) || null;
      const sections =
        type === "feuille"
          ? manualSections.filter((s) => s.largeur > 0 && s.hauteur > 0)
          : preview;
      await onSave({
        type,
        nature,
        nom: nom.trim() || null,
        largeur: L,
        hauteur: l,
        profondeur: needs("profondeur") ? h : null,
        sections,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const numInput = (
    value: string,
    setValue: (v: string) => void,
    placeholder: string,
  ) => (
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
        {/* En-tête */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <h3 className="text-base font-semibold text-gray-800">
            {isEdit ? "Modifier l'élément" : "Ajouter au stock"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Type */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">
              Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {STOCK_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleTypeChange(t.id)}
                  className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    type === t.id
                      ? "border-sky-500 bg-sky-50 ring-1 ring-sky-300"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <span className="block text-sm font-medium text-gray-800">
                    {t.label}
                  </span>
                  <span className="block text-[11px] text-gray-400">
                    {t.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Nature */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">
              Nature de la feuille
            </label>
            <div className="flex gap-2">
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

          {/* Nom (optionnel) */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">
              Nom (optionnel)
            </label>
            <input
              type="text"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder={`Ex. ${typeDef.short} …`}
              className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm text-gray-800 bg-white focus:ring-2 focus:ring-sky-500/40 focus:border-sky-400 outline-none"
            />
          </div>

          {/* Dimensions */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">
              Dimensions (cm)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {needs("largeur") && (
                <div>
                  <span className="block text-[11px] text-gray-400 mb-1">
                    Longueur (L)
                  </span>
                  {numInput(largeur, setLargeur, "L")}
                </div>
              )}
              {needs("hauteur") && (
                <div>
                  <span className="block text-[11px] text-gray-400 mb-1">
                    Largeur (l)
                  </span>
                  {numInput(hauteur, setHauteur, "l")}
                </div>
              )}
              {needs("profondeur") && (
                <div>
                  <span className="block text-[11px] text-gray-400 mb-1">
                    Hauteur (h)
                  </span>
                  {numInput(profondeur, setProfondeur, "h")}
                </div>
              )}
            </div>
          </div>

          {/* Sections */}
          {type === "feuille" ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-500">
                  Sections (découpes)
                </label>
                <button
                  type="button"
                  onClick={addManualSection}
                  className="inline-flex items-center gap-1 text-xs font-medium text-sky-600 hover:text-sky-700"
                >
                  <Plus className="h-3.5 w-3.5" /> Ajouter une section
                </button>
              </div>

              {manualSections.length === 0 && (
                <p className="text-xs text-gray-400 italic py-1">
                  Aucune section. Ajoutez les découpes de cette feuille.
                </p>
              )}

              <div className="space-y-2">
                {manualSections.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 bg-gray-50/60"
                  >
                    <input
                      type="text"
                      value={s.nom}
                      onChange={(e) =>
                        updateManualSection(s.id, { nom: e.target.value })
                      }
                      placeholder="Nom"
                      className="flex-1 min-w-0 h-9 px-2 rounded-md border border-gray-300 text-sm bg-white focus:ring-2 focus:ring-sky-500/40 outline-none"
                    />
                    <input
                      type="text"
                      inputMode="decimal"
                      value={s.largeur || ""}
                      onChange={(e) =>
                        updateManualSection(s.id, {
                          largeur: Number(e.target.value.replace(/[^\d.,]/g, "")) || 0,
                        })
                      }
                      placeholder="L"
                      className="w-16 h-9 px-2 rounded-md border border-gray-300 text-sm bg-white text-center focus:ring-2 focus:ring-sky-500/40 outline-none"
                    />
                    <input
                      type="text"
                      inputMode="decimal"
                      value={s.hauteur || ""}
                      onChange={(e) =>
                        updateManualSection(s.id, {
                          hauteur: Number(e.target.value.replace(/[^\d.,]/g, "")) || 0,
                        })
                      }
                      placeholder="l"
                      className="w-16 h-9 px-2 rounded-md border border-gray-300 text-sm bg-white text-center focus:ring-2 focus:ring-sky-500/40 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => removeManualSection(s.id)}
                      className="p-1.5 rounded-md text-gray-400 hover:text-red-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">
                Sections générées
              </label>
              {preview.length === 0 ? (
                <p className="text-xs text-gray-400 italic">
                  Renseignez les dimensions pour prévisualiser les sections.
                </p>
              ) : (
                <div className="space-y-1 rounded-lg border border-gray-200 divide-y divide-gray-100">
                  {preview.map((s, i) => (
                    <div
                      key={`${s.id}-${i}`}
                      className="flex items-center justify-between px-3 py-1.5 text-sm"
                    >
                      <span className="text-gray-700 font-medium">{s.nom}</span>
                      <span className="text-xs text-gray-400">
                        {natureLabel(s.nature)} · {s.largeur}×{s.hauteur} cm
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
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

// ── Page principale ──────────────────────────────────────────

const Stock: React.FC = () => {
  const navigate = useNavigate();
  const { sheets, isLoading, createSheet, updateSheet, deleteSheet } = useStock();
  const [activeType, setActiveType] = useState<StockType>("feuille");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StockSheet | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = { feuille: 0, table_verre: 0, table_bois: 0, tableau: 0 };
    sheets.forEach((s) => (c[s.type] = (c[s.type] || 0) + 1));
    return c;
  }, [sheets]);

  const filtered = useMemo(
    () => sheets.filter((s) => s.type === activeType),
    [sheets, activeType],
  );

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (sheet: StockSheet) => {
    setEditing(sheet);
    setDialogOpen(true);
  };

  const handleSave = async (input: StockSheetInput) => {
    if (editing) {
      await updateSheet(editing.id, input);
    } else {
      await createSheet(input);
    }
  };

  const handleAdvance = async (sheet: StockSheet, sectionId: string) => {
    const sections = sheet.sections.map((s) =>
      s.id === sectionId ? { ...s, statut: nextStatut(s.statut) } : s,
    );
    try {
      await updateSheet(sheet.id, { sections });
    } catch {
      /* erreur déjà toastée dans le hook */
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
          <button
            type="button"
            onClick={openCreate}
            className="ml-auto inline-flex items-center gap-2 rounded-xl bg-gray-900 text-white px-4 py-2.5 text-sm font-medium shadow-sm hover:bg-gray-800 transition-colors"
          >
            <Plus className="h-4 w-4" /> Ajouter
          </button>
        </div>

        {/* Légende statuts */}
        <StatutLegend />

        {/* Onglets */}
        <div className="flex flex-nowrap gap-2 mb-5 overflow-x-auto pb-2 -mb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {STOCK_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveType(t.id)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all border whitespace-nowrap ${
                activeType === t.id
                  ? "bg-gray-900 text-white border-gray-900 shadow-sm"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              }`}
            >
              {t.label}
              <span
                className={`text-[11px] rounded-full px-1.5 ${
                  activeType === t.id ? "bg-white/20" : "bg-gray-100 text-gray-500"
                }`}
              >
                {counts[t.id] || 0}
              </span>
            </button>
          ))}
        </div>

        {/* Contenu */}
        {isLoading ? (
          <p className="text-sm text-gray-400 text-center py-12">Chargement…</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-gray-300 rounded-2xl bg-white/50">
            <Layers className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">
              Aucun élément dans « {STOCK_TYPES.find((t) => t.id === activeType)?.label} »
            </p>
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
            {filtered.map((sheet) => (
              <SheetCard
                key={sheet.id}
                sheet={sheet}
                onAdvance={(sid) => handleAdvance(sheet, sid)}
                onDelete={() => setDeleteId(sheet.id)}
                onEdit={() => openEdit(sheet)}
              />
            ))}
          </div>
        )}
      </div>

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
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-gray-800 mb-2">
              Confirmer la suppression
            </h3>
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
