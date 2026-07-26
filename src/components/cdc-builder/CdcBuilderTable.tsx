// src/components/cdc-builder/CdcBuilderTable.tsx
// Tableau de matériaux groupé par section (Découpe, Éclairage, Outillage, Métal, Vinyl).
// v4: support groupes (Feuille → Plaques) avec checkboxes + bouton Grouper.

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
  /** Métadonnées par ligne (clé = `${section}-${item.id}`). Utilisé pour les badges enseigne en vue consolidée. */
  rowMeta?: Record<string, { enseigneBadge?: { nom: string; color?: string } }>;
  /** Highlights temporaires après action Brico (clé = `${section}-${index}`) */
  highlights?: Record<string, "added" | "modified">;
  /** ID de l'enseigne propriétaire — passé aux rows pour le data-highlight-key */
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

  // --- 🆕 État sélection pour le mode Grouper ---
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [groupDialogSection, setGroupDialogSection] = useState<string | null>(null);

  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    setSelectedKeys(new Set());
    setGroupDialogSection(null);
  };

  const handleCheckChange = useCallback(
    (key: string, checked: boolean) => {
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        if (checked) next.add(key);
        else next.delete(key);
        return next;
      });
    },
    [],
  );

  /** Créer un groupe à partir des lignes sélectionnées */
  const handleGroupSelected = useCallback(
    (section: string) => {
      // Récupérer les rows sélectionnées (non-groupes uniquement)
      const selectedRows = rows.filter(
        (r) => r.section === section && selectedKeys.has(r.item.id) && !r.item.groupe_enfants,
      );
      if (selectedRows.length < 2) return;

      // Ouvrir le dialogue de choix du matériau feuille
      setGroupDialogSection(section);
    },
    [rows, selectedKeys],
  );

  /** Confirmer la création du groupe avec un matériau feuille */
  const handleConfirmGroup = useCallback(
    (entry: MaterialCatalogEntry) => {
      if (!groupDialogSection) return;
      const section = groupDialogSection;

      // Récupérer les rows sélectionnées
      const selectedRows = rows.filter(
        (r) => r.section === section && selectedKeys.has(r.item.id) && !r.item.groupe_enfants,
      );

      // Créer les enfants (= copies des plaques sélectionnées)
      const enfants: MaterialItem[] = selectedRows.map((r) => ({
        ...r.item,
        id: crypto.randomUUID?.() || `pla-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      }));

      // Calculer la surface de chute
      const feuilleSurface = (entry.largeur_std || 0) * (entry.hauteur_std || 0);
      const surfaceOccupee = enfants.reduce(
        (sum, e) => sum + (e.largeur || 0) * (e.hauteur || 0) * (e.quantite || 1),
        0,
      );
      const chuteSurface = Math.max(0, feuilleSurface - surfaceOccupee);

      // Créer l'item groupe
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
        // 🆕 Groupe
        groupe_enfants: [
          ...enfants,
          // Ajouter la chute si surface > 0
          ...(chuteSurface > 0.001
            ? [
                {
                  id: crypto.randomUUID?.() || `chu-${Date.now()}`,
                  nom: "Chute",
                  quantite: 1,
                  unite: "plaque",
                  largeur: Math.round(Math.sqrt(chuteSurface) * 100) / 100,
                  hauteur: Math.round(Math.sqrt(chuteSurface) * 100) / 100,
                } as MaterialItem,
              ]
            : []),
        ],
        groupe_material_id: entry.id,
        groupe_nom: `${entry.materiau}${entry.epaisseur ? ` ${entry.epaisseur}` : ""}`,
        groupe_format: entry.format_standard || undefined,
        groupe_largeur: entry.largeur_std ?? undefined,
        groupe_hauteur: entry.hauteur_std ?? undefined,
      };

      // Supprimer les lignes sélectionnées et ajouter le groupe
      const selectedIds = new Set(selectedKeys);
      let filtered = rows.filter((r) => !(r.section === section && selectedIds.has(r.item.id)));
      // Re-index
      filtered = filtered.map((r) => {
        if (r.section === section) {
          const newIndex = filtered.filter(
            (fr) => fr.section === section && filtered.indexOf(fr) < filtered.indexOf(r),
          ).length;
          return { ...r, index: newIndex };
        }
        return r;
      });
      // Ajouter le groupe
      const groupCount = filtered.filter((r) => r.section === section).length;
      filtered.push({ section, index: groupCount, item: groupItem });

      onRowsChange(filtered);
      setSelectionMode(false);
      setSelectedKeys(new Set());
      setGroupDialogSection(null);
    },
    [rows, selectedKeys, groupDialogSection, onRowsChange],
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

  /** 🆕 Mise à jour des enfants d'un groupe */
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

  /** 🆕 Suppression d'un enfant */
  const handleDeleteEnfant = useCallback(
    (section: string, index: number, enfantIndex: number) => {
      const row = rows.find((r) => r.section === section && r.index === index);
      if (!row?.item.groupe_enfants) return;
      const newEnfants = row.item.groupe_enfants.filter((_, i) => i !== enfantIndex);
      handleChangeEnfants(section, index, newEnfants);
    },
    [rows, handleChangeEnfants],
  );

  /** 🆕 Ajout d'un enfant */
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
      {/* 🆕 Barre d'outils : mode sélection */}
      {!disabled && (
        <div className="flex items-center gap-2 mb-1">
          <button
            type="button"
            onClick={toggleSelectionMode}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
              selectionMode
                ? "bg-indigo-100 text-indigo-700 border border-indigo-200"
                : "text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 border border-gray-200"
            }`}
            title="Sélectionner des plaques pour les grouper en feuille"
          >
            <Layers size={14} />
            {selectionMode ? "Quitter le mode groupe" : "🧩 Grouper en feuille"}
          </button>
          {selectionMode && (
            <span className="text-xs text-gray-400">
              {selectedKeys.size} sélectionnée{selectedKeys.size > 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}

      {/* Sections avec contenu */}
      {nonEmptySections.map((section) => {
        const sectionRows = grouped.get(section) || [];
        const canGroup = GROUPABLE_SECTIONS.includes(section);
        const selectableCount = sectionRows.filter(
          (r) => !r.item.groupe_enfants,
        ).length;

        return (
          <div key={section} className="border border-gray-200 rounded-lg bg-white overflow-hidden">
            <div className={`flex items-center justify-between px-4 py-1.5 ${sectionBadge[section] || "bg-gray-50 text-gray-600"}`}>
              <div className="flex items-center gap-2">
                <span className="text-sm">{sectionIcon[section]}</span>
                <span className="text-xs font-semibold uppercase tracking-wide">{section}</span>
                <span className="text-[10px] opacity-50">({sectionRows.length})</span>
              </div>
              {/* 🆕 Bouton Grouper dans le header de section */}
              {selectionMode && canGroup && selectableCount >= 2 && selectedKeys.size >= 2 && (
                <button
                  type="button"
                  onClick={() => handleGroupSelected(section)}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-indigo-500 text-white hover:bg-indigo-600 font-medium transition-colors"
                >
                  <Layers size={12} />
                  Grouper ({selectedKeys.size})
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
                      showCheckbox={selectionMode && canGroup}
                      checked={selectedKeys.has(r.item.id)}
                      onCheckChange={(checked) => handleCheckChange(r.item.id, checked)}
                    />
                  </div>
                );
              })}
              {/* Bouton Ajouter — après la dernière ligne */}
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

      {/* 🆕 Dialogue de choix du matériau feuille */}
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
                {selectedKeys.size} plaques → 1 feuille dans « {groupDialogSection} »
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
