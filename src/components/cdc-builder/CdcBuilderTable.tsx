// src/components/cdc-builder/CdcBuilderTable.tsx
// Tableau de matériaux groupé par section (Découpe, Éclairage, Outillage, Métal, Vinyl).
// Sections vides masquées/grisées. Boutons d'ajout par section.

import React, { useMemo, useCallback } from "react";
import { Plus } from "lucide-react";
import CdcBuilderRow from "./CdcBuilderRow";
import type { MaterialItem } from "@/types";
import type { FlatMaterialRow } from "@/components/templates/shared/MaterialTable";

const DEFAULT_SECTIONS = [
  "Découpe",
  "Éclairage",
  "Outillage",
  "Métal",
  "Vinyl",
] as const;

const sectionBadge: Record<string, string> = {
  Découpe: "bg-red-100 text-red-700",
  Éclairage: "bg-yellow-100 text-yellow-700",
  Outillage: "bg-green-100 text-green-700",
  Métal: "bg-gray-200 text-gray-700",
  Vinyl: "bg-purple-100 text-purple-700",
};

const sectionIcon: Record<string, string> = {
  Découpe: "📋",
  Éclairage: "💡",
  Outillage: "🔩",
  Métal: "🔧",
  Vinyl: "🎨",
};

// --- Conversion FlatMaterialRow[] ↔ Record<section, MaterialItem[]> ---
export function rowsToSections(
  rows: FlatMaterialRow[],
): Record<string, MaterialItem[]> {
  const sections: Record<string, MaterialItem[]> = {};
  for (const row of rows) {
    if (!sections[row.section]) sections[row.section] = [];
    sections[row.section].push(row.item);
  }
  return sections;
}

export function sectionsToRows(
  sections: Record<string, MaterialItem[]>,
): FlatMaterialRow[] {
  const rows: FlatMaterialRow[] = [];
  for (const [section, items] of Object.entries(sections)) {
    items.forEach((item, index) => rows.push({ section, index, item }));
  }
  return rows;
}

// --- Props ---
export interface CdcBuilderTableProps {
  rows: FlatMaterialRow[];
  defaultDimensions: { largeur: number; hauteur: number };
  onRowsChange: (rows: FlatMaterialRow[]) => void;
  enseigneNom: string;
  disabled?: boolean;
}

const CdcBuilderTable: React.FC<CdcBuilderTableProps> = ({
  rows,
  defaultDimensions,
  onRowsChange,
  enseigneNom,
  disabled = false,
}) => {
  // Grouper les lignes par section
  const grouped = useMemo(() => {
    const map = new Map<string, FlatMaterialRow[]>();
    for (const section of DEFAULT_SECTIONS) {
      map.set(section, []);
    }
    for (const row of rows) {
      const existing = map.get(row.section) || [];
      existing.push(row);
      map.set(row.section, existing);
    }
    return map;
  }, [rows]);

  const handleAddRow = useCallback(
    (section: string) => {
      const newItem: MaterialItem = {
        id: crypto.randomUUID?.() ||
          `mat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        nom: "",
        quantite: 1,
        unite: "",
        largeur: section === "Découpe" || section === "Vinyl"
          ? defaultDimensions.largeur
          : undefined,
        hauteur: section === "Découpe" || section === "Vinyl"
          ? defaultDimensions.hauteur
          : undefined,
      };
      const newRows = [...rows, { section, index: rows.filter(r => r.section === section).length, item: newItem }];
      onRowsChange(newRows);
    },
    [rows, defaultDimensions, onRowsChange],
  );

  const handleChangeRow = useCallback(
    (section: string, index: number, changes: Partial<MaterialItem>) => {
      const newRows = rows.map((r) => {
        if (r.section === section && r.index === index) {
          return { ...r, item: { ...r.item, ...changes } };
        }
        return r;
      });
      onRowsChange(newRows);
    },
    [rows, onRowsChange],
  );

  const handleDeleteRow = useCallback(
    (section: string, index: number) => {
      let filtered = rows.filter(
        (r) => !(r.section === section && r.index === index),
      );
      // Réindexer les lignes de la section
      filtered = filtered.map((r) => {
        if (r.section === section && r.index > index) {
          return { ...r, index: r.index - 1 };
        }
        return r;
      });
      onRowsChange(filtered);
    },
    [rows, onRowsChange],
  );

  // Sections qui ont au moins 1 ligne
  const nonEmptySections = DEFAULT_SECTIONS.filter(
    (s) => (grouped.get(s) || []).length > 0,
  );

  return (
    <div className="space-y-4">
      {/* Bouton [+ Ajouter] global — dropdown rapide pour choisir la section */}
      {!disabled && (
        <div className="flex items-center gap-2">
          <div className="relative group">
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                         bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100
                         transition-colors"
            >
              <Plus size={14} />
              Ajouter une ligne
            </button>

            {/* Dropdown sections */}
            <div
              className="absolute left-0 top-full mt-1 z-40 bg-white border border-gray-200
                         rounded-lg shadow-lg py-1 min-w-[180px]
                         opacity-0 invisible group-hover:opacity-100 group-hover:visible
                         transition-all duration-150"
            >
              {DEFAULT_SECTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleAddRow(s)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left
                             text-gray-700 hover:bg-indigo-50 hover:text-indigo-700
                             transition-colors"
                >
                  <span>{sectionIcon[s]}</span>
                  <span>{s}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sections avec contenu */}
      {nonEmptySections.map((section) => {
        const sectionRows = grouped.get(section) || [];
        return (
          <div
            key={section}
            className="border border-gray-200 rounded-lg bg-white overflow-hidden"
          >
            {/* Section header */}
            <div
              className={`flex items-center justify-between px-4 py-2.5
                          ${sectionBadge[section] || "bg-gray-50 text-gray-600"}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">{sectionIcon[section]}</span>
                <span className="text-sm font-semibold uppercase tracking-wide">
                  {section}
                </span>
                <span className="text-xs opacity-60">
                  ({sectionRows.length} ligne{sectionRows.length > 1 ? "s" : ""})
                </span>
              </div>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleAddRow(section)}
                  className="flex items-center gap-1 text-xs font-medium
                             text-current opacity-70 hover:opacity-100
                             transition-opacity"
                >
                  <Plus size={12} />
                  Ajouter à {section}
                </button>
              )}
            </div>

            {/* Lignes */}
            <div className="px-4 py-2">
              {sectionRows.map((r) => (
                <CdcBuilderRow
                  key={`${section}-${r.item.id}`}
                  row={r}
                  defaultDimensions={defaultDimensions}
                  onChange={(changes) =>
                    handleChangeRow(section, r.index, changes)
                  }
                  onDelete={() => handleDeleteRow(section, r.index)}
                  disabled={disabled}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* Sections vides — grisées, juste un indicateur */}
      {DEFAULT_SECTIONS.filter(
        (s) => (grouped.get(s) || []).length === 0,
      ).map((section) => (
        <div
          key={section}
          className="border border-dashed border-gray-200 rounded-lg px-4 py-3
                     bg-gray-50/50 text-xs text-gray-400 flex items-center gap-2"
        >
          <span>{sectionIcon[section]}</span>
          <span>{section}</span>
          <span className="italic">— vide</span>
          {!disabled && (
            <button
              type="button"
              onClick={() => handleAddRow(section)}
              className="ml-auto text-indigo-400 hover:text-indigo-600
                         font-medium transition-colors"
            >
              + Ajouter
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

export default CdcBuilderTable;
