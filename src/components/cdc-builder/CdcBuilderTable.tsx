// src/components/cdc-builder/CdcBuilderTable.tsx
// Tableau de matériaux groupé par section (Découpe, Éclairage, Outillage, Métal, Vinyl).
// v3: retrait du "+ Ajouter une ligne" global, routage automatique section↔catégorie matériau.

import React, { useMemo, useCallback } from "react";
import { Plus } from "lucide-react";
import CdcBuilderRow from "./CdcBuilderRow";
import type { MaterialItem } from "@/types";
import type { FlatMaterialRow } from "@/components/templates/shared/MaterialTable";
import type { MaterialCatalogEntry } from "@/types/materialCatalog";

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

// --- Conversion ---
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
  /** Métadonnées par ligne (clé = `${section}-${item.id}`). Utilisé pour les badges enseigne en vue consolidée. */
  rowMeta?: Record<string, { enseigneBadge?: { nom: string; color?: string } }>;
  /** Highlights temporaires après action Brico (clé = `${section}-${index}`) */
  highlights?: Record<string, "added" | "modified">;
}

const CdcBuilderTable: React.FC<CdcBuilderTableProps> = ({
  rows,
  defaultDimensions,
  onRowsChange,
  enseigneNom,
  disabled = false,
  rowMeta,
  highlights,
}) => {
  const grouped = useMemo(() => {
    const map = new Map<string, FlatMaterialRow[]>();
    for (const section of DEFAULT_SECTIONS) map.set(section, []);
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
        id: crypto.randomUUID?.() || `mat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        nom: "",
        quantite: 1,
        unite: "",
        largeur: section === "Découpe" || section === "Vinyl" ? defaultDimensions.largeur : undefined,
        hauteur: section === "Découpe" || section === "Vinyl" ? defaultDimensions.hauteur : undefined,
      };
      const newRows = [...rows, { section, index: rows.filter(r => r.section === section).length, item: newItem }];
      onRowsChange(newRows);
    },
    [rows, defaultDimensions, onRowsChange],
  );

  const handleChangeRow = useCallback(
    (section: string, index: number, changes: Partial<MaterialItem>) => {
      const newRows = rows.map((r) =>
        r.section === section && r.index === index
          ? { ...r, item: { ...r.item, ...changes } }
          : r,
      );
      onRowsChange(newRows);
    },
    [rows, onRowsChange],
  );

  const handleDeleteRow = useCallback(
    (section: string, index: number) => {
      let filtered = rows.filter(
        (r) => !(r.section === section && r.index === index),
      );
      filtered = filtered.map((r) => {
        if (r.section === section && r.index > index) return { ...r, index: r.index - 1 };
        return r;
      });
      onRowsChange(filtered);
    },
    [rows, onRowsChange],
  );

  /** Routage : matériau catalogue dans mauvaise section → supprimer ici, créer là-bas */
  const handleMoveToSection = useCallback(
    (fromSection: string, fromIndex: number, toSection: string, preset: Partial<MaterialItem>) => {
      // 1. Supprimer la ligne actuelle
      let filtered = rows.filter(
        (r) => !(r.section === fromSection && r.index === fromIndex),
      );
      filtered = filtered.map((r) => {
        if (r.section === fromSection && r.index > fromIndex) return { ...r, index: r.index - 1 };
        return r;
      });

      // 2. Ajouter dans la section cible
      const newItem: MaterialItem = {
        id: crypto.randomUUID?.() || `mat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        nom: preset.nom || "",
        quantite: preset.quantite || 1,
        unite: preset.unite || "",
        largeur: preset.largeur,
        hauteur: preset.hauteur,
        couleur: preset.couleur,
        epaisseur: preset.epaisseur,
        reference: preset.reference,
        material_id: preset.material_id,
        format_standard: preset.format_standard,
        cout_unitaire: preset.cout_unitaire,
        couleurs_dispo: preset.couleurs_dispo,
      };
      const targetCount = filtered.filter(r => r.section === toSection).length;
      filtered.push({ section: toSection, index: targetCount, item: newItem });

      onRowsChange(filtered);
    },
    [rows, onRowsChange],
  );

  const nonEmptySections = DEFAULT_SECTIONS.filter(
    (s) => (grouped.get(s) || []).length > 0,
  );

  return (
    <div className="space-y-4">
      {/* Sections avec contenu */}
      {nonEmptySections.map((section) => {
        const sectionRows = grouped.get(section) || [];
        return (
          <div key={section} className="border border-gray-200 rounded-lg bg-white overflow-hidden">
            <div className={`flex items-center justify-between px-4 py-2.5 ${sectionBadge[section] || "bg-gray-50 text-gray-600"}`}>
              <div className="flex items-center gap-2">
                <span className="text-sm">{sectionIcon[section]}</span>
                <span className="text-sm font-semibold uppercase tracking-wide">{section}</span>
                <span className="text-xs opacity-60">({sectionRows.length} ligne{sectionRows.length > 1 ? "s" : ""})</span>
              </div>
              {!disabled && (
                <button type="button" onClick={() => handleAddRow(section)}
                  className="flex items-center gap-1 text-xs font-medium text-current opacity-70 hover:opacity-100 transition-opacity">
                  <Plus size={12} /> Ajouter à {section}
                </button>
              )}
            </div>

            <div className="px-4 py-2">
              {sectionRows.map((r) => (
                <CdcBuilderRow
                  key={`${section}-${r.item.id}`}
                  row={r}
                  defaultDimensions={defaultDimensions}
                  onChange={(changes) => handleChangeRow(section, r.index, changes)}
                  onDelete={() => handleDeleteRow(section, r.index)}
                  onMoveToSection={
                    !disabled
                      ? (targetSection, preset) =>
                          handleMoveToSection(section, r.index, targetSection, preset)
                      : undefined
                  }
                  disabled={disabled}
                  enseigneBadge={rowMeta?.[`${section}-${r.item.id}`]?.enseigneBadge}
                  flashType={highlights?.[`${section}-${r.index}`]}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* Sections vides */}
      {DEFAULT_SECTIONS.filter((s) => (grouped.get(s) || []).length === 0).map((section) => (
        <div key={section}
          className="border border-dashed border-gray-200 rounded-lg px-4 py-3 bg-gray-50/50 text-xs text-gray-400 flex items-center gap-2">
          <span>{sectionIcon[section]}</span>
          <span>{section}</span>
          <span className="italic">— vide</span>
          {!disabled && (
            <button type="button" onClick={() => handleAddRow(section)}
              className="ml-auto text-indigo-400 hover:text-indigo-600 font-medium transition-colors">
              + Ajouter
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

export default CdcBuilderTable;
