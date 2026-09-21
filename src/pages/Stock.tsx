// src/pages/Stock.tsx
// Page Stock — gestion logistique des matériaux de découpe (vitre, plexiglass, miroir).
// 4 vues (Feuilles / Tables en verre / Tables en bois / Tableaux), sections découpées
// avec pose de statut (découpé / raboté / utilisé) + audit des changements.

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
} from "lucide-react";
import { useStock } from "@/hooks/useStock";
import type { User } from "@/types";
import {
  StockSheet,
  StockSection,
  StockType,
  StockNature,
  StockHistoryEvent,
  SectionStatut,
  STOCK_TYPES,
  STOCK_NATURES,
  SECTION_STATUTS,
  generateSections,
  typeLabel,
  natureLabel,
  statutLabel,
  parseCm,
} from "@/types/stock";

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

// ── Figure d'une section (rectangle proportionnel) ───────────

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
      className="flex flex-col items-center gap-1 p-2 rounded-xl bg-white border border-gray-100 hover:border-gray-300 hover:shadow-sm transition-all active:scale-95 cursor-pointer"
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
  if (sheet.longueur != null) parts.push(`L ${sheet.longueur}`);
  if (sheet.largeur != null) parts.push(`l ${sheet.largeur}`);
  if (sheet.hauteur != null) parts.push(`h ${sheet.hauteur}`);
  return parts.length ? `${parts.join(" × ")} cm` : "—";
};

const SheetCard: React.FC<{
  sheet: StockSheet;
  onSelectStatut: (section: StockSection) => void;
  onDelete: () => void;
  onEdit: () => void;
}> = ({ sheet, onSelectStatut, onDelete, onEdit }) => {
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
              {sheet.sections.map((s) => (
                <SectionFigure
                  key={s.id}
                  section={s}
                  onSelect={() => onSelectStatut(s)}
                />
              ))}
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
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          {section.nom} · {section.largeur}×{section.hauteur} cm ·{" "}
          {natureLabel(section.nature)}
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
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ background: s.fill }}
                  />
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

// ── Dialogue ajout / édition ─────────────────────────────────

const AddSheetDialog: React.FC<{
  sheet?: StockSheet | null;
  onClose: () => void;
  onSave: (input: import("@/types/stock").StockSheetInput) => Promise<void>;
}> = ({ sheet, onClose, onSave }) => {
  const isEdit = !!sheet;
  const [type, setType] = useState<StockType>(sheet?.type ?? "feuille");
  const [nature, setNature] = useState<StockNature>(sheet?.nature ?? "vitre");
  const [nom, setNom] = useState(sheet?.nom ?? "");
  const [epaisseur, setEpaisseur] = useState(sheet?.epaisseur ?? "");
  const [longueur, setLongueur] = useState(
    sheet?.longueur != null ? String(sheet.longueur) : "",
  );
  const [largeur, setLargeur] = useState(
    sheet?.largeur != null ? String(sheet.largeur) : "",
  );
  const [hauteur, setHauteur] = useState(
    sheet?.hauteur != null ? String(sheet.hauteur) : "",
  );
  const [manualSections, setManualSections] = useState<StockSection[]>(
    sheet?.type === "feuille" ? sheet.sections : [],
  );
  const [saving, setSaving] = useState(false);

  const typeDef = STOCK_TYPES.find((t) => t.id === type)!;
  const needs = (f: "longueur" | "largeur" | "hauteur") =>
    typeDef.fields.includes(f);

  const preview = useMemo(() => {
    if (type === "feuille") return [];
    const L = parseCm(longueur) ?? 0;
    const l = parseCm(largeur) ?? 0;
    const h = parseCm(hauteur) ?? 0;
    return generateSections(type, L, l, h);
  }, [type, longueur, largeur, hauteur]);

  const handleTypeChange = (t: StockType) => {
    setType(t);
    if (t === "feuille") {
      setManualSections((prev) => (isEdit && sheet?.type === "feuille" ? prev : []));
    }
  };

  const addManualSection = () => {
    setManualSections((prev) => [
      ...prev,
      { id: crypto.randomUUID(), nom: "", nature, largeur: 0, hauteur: 0, statut: "decoupe" },
    ]);
  };

  const updateManualSection = (id: string, patch: Partial<StockSection>) => {
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
      const sections =
        type === "feuille"
          ? manualSections.filter((s) => s.largeur > 0 && s.hauteur > 0)
          : preview;
      await onSave({
        type,
        nature,
        nom: nom.trim() || null,
        longueur: parseCm(longueur),
        largeur: parseCm(largeur),
        hauteur: needs("hauteur") ? parseCm(hauteur) : null,
        epaisseur: epaisseur.trim() || null,
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

  const dimField = (label: string, value: string, setValue: (v: string) => void, ph: string) => (
    <div>
      <span className="block text-[11px] text-gray-400 mb-1">{label}</span>
      {numInput(value, setValue, ph)}
    </div>
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
            {isEdit ? "Modifier l'élément" : "Ajouter au stock"}
          </h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Type */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Type</label>
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
                  <span className="block text-sm font-medium text-gray-800">{t.label}</span>
                  <span className="block text-[11px] text-gray-400">{t.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Nature */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Nature de la feuille</label>
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

          {/* Nom + épaisseur */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">Nom (optionnel)</label>
              <input
                type="text"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder={`Ex. ${typeDef.short} …`}
                className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm text-gray-800 bg-white focus:ring-2 focus:ring-sky-500/40 focus:border-sky-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">Épaisseur (optionnel)</label>
              <input
                type="text"
                value={epaisseur}
                onChange={(e) => setEpaisseur(e.target.value)}
                placeholder="ex. 8 mm"
                className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm text-gray-800 bg-white focus:ring-2 focus:ring-sky-500/40 focus:border-sky-400 outline-none"
              />
            </div>
          </div>

          {/* Dimensions */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Dimensions (cm)</label>
            <div className="grid grid-cols-3 gap-2">
              {needs("longueur") && dimField("Longueur (L)", longueur, setLongueur, "L")}
              {needs("largeur") && dimField("Largeur (l)", largeur, setLargeur, "l")}
              {needs("hauteur") && dimField("Hauteur (h)", hauteur, setHauteur, "h")}
            </div>
          </div>

          {/* Sections */}
          {type === "feuille" ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-500">Sections (découpes)</label>
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
                      onChange={(e) => updateManualSection(s.id, { nom: e.target.value })}
                      placeholder="Nom"
                      className="flex-1 min-w-0 h-9 px-2 rounded-md border border-gray-300 text-sm bg-white focus:ring-2 focus:ring-sky-500/40 outline-none"
                    />
                    <input
                      type="text"
                      inputMode="decimal"
                      value={s.largeur || ""}
                      onChange={(e) =>
                        updateManualSection(s.id, {
                          largeur: Number(e.target.value.replace(/[^\d.,]/g, "").replace(",", ".")) || 0,
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
                          hauteur: Number(e.target.value.replace(/[^\d.,]/g, "").replace(",", ".")) || 0,
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
              <label className="block text-xs font-medium text-gray-500 mb-2">Sections générées</label>
              {preview.length === 0 ? (
                <p className="text-xs text-gray-400 italic">
                  Renseignez les dimensions pour prévisualiser les sections.
                </p>
              ) : (
                <div className="space-y-1 rounded-lg border border-gray-200 divide-y divide-gray-100">
                  {preview.map((s, i) => (
                    <div key={`${s.id}-${i}`} className="flex items-center justify-between px-3 py-1.5 text-sm">
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

const Stock: React.FC<{ user: User | null }> = ({ user }) => {
  const navigate = useNavigate();
  const { sheets, isLoading, createSheet, updateSheet, deleteSheet } = useStock();
  const [activeType, setActiveType] = useState<StockType>("feuille");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StockSheet | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [statutTarget, setStatutTarget] = useState<StockSheet | null>(null);
  const [statutSection, setStatutSection] = useState<StockSection | null>(null);

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

    if (section.statut !== newStatut) {
      const sections = sheet.sections.map((s) =>
        s.id === section.id ? { ...s, statut: newStatut } : s,
      );
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
        /* conflit déjà géré par le hook (toast + refetch) */
      }
    }

    setStatutTarget(null);
    setStatutSection(null);
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
              <span className={`text-[11px] rounded-full px-1.5 ${activeType === t.id ? "bg-white/20" : "bg-gray-100 text-gray-500"}`}>
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
                onSelectStatut={(section) => openStatutPicker(sheet, section)}
                onDelete={() => setDeleteId(sheet.id)}
                onEdit={() => openEdit(sheet)}
              />
            ))}
          </div>
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
