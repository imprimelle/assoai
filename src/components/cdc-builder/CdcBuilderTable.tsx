// src/components/cdc-builder/CdcBuilderTable.tsx
// Tableau de matériaux groupé par section (Découpe, Éclairage, Outillage, Métal, Vinyl).
// v5: swipe-to-reveal checkbox sur chaque ligne Découpe/Vinyl — plus de toggle mode sélection.

import React, { useMemo, useCallback, useState } from "react";
import { Plus, Layers } from "lucide-react";
import CdcBuilderRow from "./CdcBuilderRow";
import MaterialSuggestions from "@/components/materials/MaterialSuggestions";
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

/** Sections éligibles aux groupes */
const GROUPABLE_SECTIONS = ["Découpe", "Vinyl"];

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
  rowMeta?: Record<string, { enseigneBadge?: { nom: string; color?: string } }>;
  highlights?: Record<string, "added" | "modified">;
  enseigneId?: string;
}

const CdcBuilderTable: React.FC<CdcBuilderTableProps> = ({
  rows,
  defaultDimensions,
  onRowsChange,
  enseigneNom,
  disabled = false,
  rowMeta,
  highlights,
  enseigneId,
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

  // Checkboxes persistantes — pas de mode à activer
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [groupDialogSection, setGroupDialogSection] = useState<string | null>(null);

  const handleCheckChange = useCallback(
    (itemId: string, checked: boolean) => {
      setCheckedItems((prev) => {
        const next = new Set(prev);
        if (checked) next.add(itemId);
        else next.delete(itemId);
        return next;
      });
    },
    [],
  );

  /** Créer un groupe à partir des lignes cochées */
  const handleGroupSelected = useCallback(
    (section: string) => {
      const selectedRows = rows.filter(
        (r) => r.section === section && checkedItems.has(r.item.id) && !r.item.groupe_enfants,
      );
      if (selectedRows.length < 2) return;
      setGroupDialogSection(section);
    },
    [rows, checkedItems],
  );

  /** Confirmer la création du groupe avec un matériau feuille */
  const handleConfirmGroup = useCallback(
    (entry: MaterialCatalogEntry) => {
      if (!groupDialogSection) return;
      const section = groupDialogSection;

      const selectedRows = rows.filter(
        (r) => r.section === section && checkedItems.has(r.item.id) && !r.item.groupe_enfants,
      );

      const enfants: MaterialItem[] = selectedRows.map((r) => ({
        ...r.item,
        id: crypto.randomUUID?.() || `pla-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      }));

      const feuilleSurface = (entry.largeur_std || 0) * (entry.hauteur_std || 0);
      const surfaceOccupee = enfants.reduce(
        (sum, e) => sum + (e.largeur || 0) * (e.hauteur || 0) * (e.quantite || 1),
        0,
      );
      const chuteSurface = Math.max(0, feuilleSurface - surfaceOccupee);

      const groupItem: MaterialItem = {
        id: crypto.randomUUID?.() || `grp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        nom: `${entry.materiau}${entry.epaisseur ? ` ${entry.epaisseur}` : ""}`,
        quantite: 1,
        unite: "Feuille",
        largeur: entry.largeur_std ?? undefined,
        hauteur: entry.hauteur_std ?? undefined,
        epaisseur: entry.epaisseur || undefined,
        material_id: entry.id,
        format_standard: entry.format_standard || undefined,
        cout_unitaire: entry.cout_min ?? undefined,
        couleurs_dispo: entry.couleurs?.length ? entry.couleurs : undefined,
        groupe_enfants: [
          ...enfants,
          ...(chuteSurface > 0.001
            ? [{
                id: crypto.randomUUID?.() || `chu-${Date.now()}`,
                nom: "Chute",
                quantite: 1,
                unite: "plaque",
                largeur: Math.round(Math.sqrt(chuteSurface) * 100) / 100,
                hauteur: Math.round(Math.sqrt(chuteSurface) * 100) / 100,
              } as MaterialItem]
            : []),
        ],
        groupe_material_id: entry.id,
        groupe_nom: `${entry.materiau}${entry.epaisseur ? ` ${entry.epaisseur}` : ""}`,
        groupe_format: entry.format_standard || undefined,
        groupe_largeur: entry.largeur_std ?? undefined,
        groupe_hauteur: entry.hauteur_std ?? undefined,
      };

      const selectedIds = new Set(checkedItems);
      let filtered = rows.filter((r) => !(r.section === section && selectedIds.has(r.item.id)));
      filtered = filtered.map((r) => {
        if (r.section === section) {
          const newIndex = filtered.filter(
            (fr) => fr.section === section && filtered.indexOf(fr) < filtered.indexOf(r),
          ).length;
          return { ...r, index: newIndex };
        }
        return r;
      });
      const groupCount = filtered.filter((r) => r.section === section).length;
      filtered.push({ section, index: groupCount, item: groupItem });

      onRowsChange(filtered);
      setCheckedItems(new Set());
      setGroupDialogSection(null);
    },
    [rows, checkedItems, groupDialogSection, onRowsChange],
  );

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

  const handleChangeEnfants = useCallback(
    (section: string, index: number, enfants: MaterialItem[]) => {
      const newRows = rows.map((r) =>
        r.section === section && r.index === index
          ? { ...r, item: { ...r.item, groupe_enfants: enfants } }
          : r,
      );
      onRowsChange(newRows);
    },
    [rows, onRowsChange],
  );

  const handleDeleteEnfant = useCallback(
    (section: string, index: number, enfantIndex: number) => {
      const row = rows.find((r) => r.section === section && r.index === index);
      if (!row?.item.groupe_enfants) return;
      const newEnfants = row.item.groupe_enfants.filter((_, i) => i !== enfantIndex);
      handleChangeEnfants(section, index, newEnfants);
    },
    [rows, handleChangeEnfants],
  );

  const handleAddEnfant = useCallback(
    (section: string, index: number) => {
      const row = rows.find((r) => r.section === section && r.index === index);
      if (!row) return;
      const newEnfant: MaterialItem = {
        id: crypto.randomUUID?.() || `enf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        nom: "",
        quantite: 1,
        unite: "plaque",
        largeur: defaultDimensions.largeur,
        hauteur: defaultDimensions.hauteur,
      };
      const newEnfants = [...(row.item.groupe_enfants || []), newEnfant];
      handleChangeEnfants(section, index, newEnfants);
    },
    [rows, defaultDimensions, handleChangeEnfants],
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
      // Nettoyer les checkboxes pour les items supprimés
      setCheckedItems((prev) => {
        const next = new Set(prev);
        const removed = rows.find((r) => r.section === section && r.index === index);
        if (removed) next.delete(removed.item.id);
        return next;
      });
      onRowsChange(filtered);
    },
    [rows, onRowsChange],
  );

  const handleMoveToSection = useCallback(
    (fromSection: string, fromIndex: number, toSection: string, preset: Partial<MaterialItem>) => {
      let filtered = rows.filter(
        (r) => !(r.section === fromSection && r.index === fromIndex),
      );
      filtered = filtered.map((r) => {
        if (r.section === fromSection && r.index > fromIndex) return { ...r, index: r.index - 1 };
        return r;
      });

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
      {nonEmptySections.map((section) => {
        const sectionRows = grouped.get(section) || [];
        const canGroup = GROUPABLE_SECTIONS.includes(section);
        // Compter les items cochés dans CETTE section uniquement
        const checkedInSection = sectionRows.filter(
          (r) => checkedItems.has(r.item.id) && !r.item.groupe_enfants,
        ).length;

        return (
          <div key={section} className="border border-gray-200 rounded-lg bg-white overflow-hidden">
            <div className={`flex items-center justify-between px-4 py-1.5 ${sectionBadge[section] || "bg-gray-50 text-gray-600"}`}>
              <div className="flex items-center gap-2">
                <span className="text-sm">{sectionIcon[section]}</span>
                <span className="text-xs font-semibold uppercase tracking-wide">{section}</span>
                <span className="text-[10px] opacity-50">({sectionRows.length})</span>
              </div>
              {/* 🆕 Bouton Grouper — apparaît quand ≥2 checkboxes cochées dans cette section */}
              {canGroup && checkedInSection >= 2 && (
                <button
                  type="button"
                  onClick={() => handleGroupSelected(section)}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-indigo-500 text-white hover:bg-indigo-600 font-medium transition-colors"
                >
                  <Layers size={12} />
                  Grouper ({checkedInSection})
                </button>
              )}
            </div>

            <div className="px-4 py-2">
              {sectionRows.map((r) => {
                const isGroup = !!(r.item.groupe_enfants && r.item.groupe_enfants.length > 0);
                return (
                  <div key={`${section}-${r.item.id}`}>
                    <CdcBuilderRow
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
                      enseigneId={enseigneId}
                      // 🆕 Props groupe
                      onChangeEnfants={
                        isGroup
                          ? (enfants) => handleChangeEnfants(section, r.index, enfants)
                          : undefined
                      }
                      onDeleteEnfant={
                        isGroup
                          ? (i) => handleDeleteEnfant(section, r.index, i)
                          : undefined
                      }
                      onAddEnfant={
                        isGroup
                          ? () => handleAddEnfant(section, r.index)
                          : undefined
                      }
                      // 🆕 Swipe-to-check — uniquement pour sections groupables, non-groupes
                      showSwipeCheck={canGroup && !isGroup}
                      checked={checkedItems.has(r.item.id)}
                      onCheckChange={(checked) => handleCheckChange(r.item.id, checked)}
                    />
                  </div>
                );
              })}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleAddRow(section)}
                  className="flex items-center gap-1 mt-1.5 text-xs text-indigo-400 hover:text-indigo-600 font-medium transition-colors w-full justify-center py-1 rounded-md hover:bg-indigo-50/50"
                >
                  <Plus size={12} />
                  Ajouter à {section}
                </button>
              )}
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

      {/* Dialogue de choix du matériau feuille */}
      {groupDialogSection && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
          onClick={() => setGroupDialogSection(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 fade-in duration-200"
          >
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                <Layers size={18} className="text-indigo-500" />
                Choisir le matériau Feuille
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                {checkedItems.size} plaques → 1 feuille dans « {groupDialogSection} »
              </p>
            </div>
            <div className="px-5 py-4">
              <MaterialSuggestions
                categorie={groupDialogSection}
                onSelect={handleConfirmGroup}
                placeholder={`Chercher une feuille ${groupDialogSection}…`}
              />
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setGroupDialogSection(null)}
                className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CdcBuilderTable;
