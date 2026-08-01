// src/components/cdc-builder/CdcBuilderTable.tsx
// Tableau de matériaux groupé par section (Découpe, Éclairage, Outillage, Métal, Vinyl).
// v7: mode sélection explicite (toggle), sélection rapide par matériau, badge groupe amélioré.

import React, { useMemo, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, Layers, X, Square, Check } from "lucide-react";
import CdcBuilderRow from "./CdcBuilderRow";
import MaterialSuggestions from "@/components/materials/MaterialSuggestions";
import type { MaterialItem } from "@/types";
import type { FlatMaterialRow } from "@/components/templates/shared/MaterialTable";
import type { MaterialCatalogEntry } from "@/types/materialCatalog";
import { shelfPack, packStats } from "@/lib/shelfPacker";
import type { FeuillePlacement } from "@/types/cdcBuilder";

const DEFAULT_SECTIONS = [
  "Découpe",
  "Éclairage",
  "Outillage",
  "Métal",
  "Vinyl",
] as const;

const GROUPABLE_SECTIONS = ["Découpe", "Vinyl"];

/** Formate un nombre en mètres (ex: 1.22 → "1.22m") */
function fmtM(v: number): string {
  return v.toFixed(2).replace(/\.?0+$/, "") + "m";
}

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

export interface CdcBuilderTableProps {
  rows: FlatMaterialRow[];
  defaultDimensions: { largeur: number; hauteur: number };
  onRowsChange: (rows: FlatMaterialRow[]) => void;
  enseigneNom: string;
  disabled?: boolean;
  rowMeta?: Record<string, { enseigneBadge?: { nom: string; color?: string } }>;
  highlights?: Record<string, "added" | "modified">;
  enseigneId?: string;
  /** 🆕 Handler de dissociation direct (travaille sur materiauxByEnseigne, pas FlatMaterialRow) */
  onDissocierEnfant?: (section: string, groupItemId: string, enfantIndex: number) => void;
  /** 🆕 Ouvrir l'aperçu feuille au niveau page */
  onOpenPreview?: (section: string, groupIndex: number) => void;
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
  onDissocierEnfant: onDissocierDirect,
  onOpenPreview,
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

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [groupDialogSection, setGroupDialogSection] = useState<string | null>(null);
  const [groupWarning, setGroupWarning] = useState<string | null>(null);

  // 🆕 Mode sélection explicite — quelles sections sont en mode sélection
  const [selectionMode, setSelectionMode] = useState<Set<string>>(new Set());

  // 🆕 Scroll sync — seule la ligne active garde son scroll horizontal
  const [activeRowKey, setActiveRowKey] = useState<string | null>(null);
  const handleRowActivate = useCallback((key: string) => {
    setActiveRowKey(key);
  }, []);

  /** Swipe sur une ligne → toggle sélection (sans ouvrir le dialogue) */
  const handleToggleSelect = useCallback(
    (itemId: string) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(itemId)) {
          next.delete(itemId);
        } else {
          next.add(itemId);
        }
        return next;
      });
    },
    [],
  );

  /** Désélectionner tout */
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // 🆕 Toggle mode sélection pour une section
  const toggleSelectionMode = useCallback((section: string) => {
    setSelectionMode(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
    // Sortir du mode sélection désélectionne tout
    if (selectionMode.has(section)) {
      setSelectedIds(new Set());
    }
  }, [selectionMode]);

  // 🆕 Sortir du mode sélection après création d'un groupe
  const exitSelectionMode = useCallback((section: string) => {
    setSelectionMode(prev => {
      const next = new Set(prev);
      next.delete(section);
      return next;
    });
    setSelectedIds(new Set());
  }, []);

  // 🆕 Tout sélectionner dans une section (non-groupes uniquement)
  const selectAllInSection = useCallback((section: string) => {
    const sectionRows = grouped.get(section) || [];
    const ids = sectionRows
      .filter(r => !r.item.groupe_enfants)
      .map(r => r.item.id);
    setSelectedIds(new Set(ids));
  }, [grouped]);

  // 🆕 Sélectionner les plaques du même matériau
  const selectSameMaterial = useCallback(() => {
    if (selectedIds.size === 0) return;
    // Prendre la première plaque sélectionnée comme référence
    const firstId = [...selectedIds][0];
    const refRow = rows.find(r => r.item.id === firstId);
    if (!refRow) return;

    const refNom = refRow.item.nom;
    const refEpaisseur = refRow.item.epaisseur;
    const section = refRow.section;

    const matchingIds = rows
      .filter(r => 
        r.section === section && 
        !r.item.groupe_enfants &&
        r.item.nom === refNom &&
        r.item.epaisseur === refEpaisseur
      )
      .map(r => r.item.id);

    setSelectedIds(new Set(matchingIds));
  }, [selectedIds, rows]);

  /** 🆕 Dissocier un enfant — délègue au handler direct du parent (bypass FlatMaterialRow) */
  const handleDissocierEnfant = useCallback(
    (section: string, groupIndex: number, enfantIndex: number) => {
      if (!onDissocierDirect) return;

      // Trouver le groupe via son index dans la section
      const sectionRows = rows.filter((r) => r.section === section);
      const groupRow = sectionRows.find((r) => r.index === groupIndex);
      if (!groupRow?.item.groupe_enfants) return;
      if (enfantIndex < 0 || enfantIndex >= groupRow.item.groupe_enfants.length) return;

      const groupItemId = groupRow.item.id;
      onDissocierDirect(section, groupItemId, enfantIndex);
    },
    [rows, onDissocierDirect],
  );

  /** Confirmer le groupe avec un matériau — utilise shelfPacker pour le placement 2D */
  const handleConfirmGroup = useCallback(
    (entry: MaterialCatalogEntry) => {
      if (!groupDialogSection) return;
      const section = groupDialogSection;

      const selectedRows = rows.filter(
        (r) => r.section === section && selectedIds.has(r.item.id) && !r.item.groupe_enfants,
      );

      const feuilleL_cm = (entry.largeur_std || 0) * 100;
      const feuilleH_cm = (entry.hauteur_std || 0) * 100;

      // 🆕 Construire les plaques pour le shelfPacker (cm → m : /100)
      const plaquesInput = selectedRows.map((r) => ({
        id: r.item.id,
        largeur: (r.item.largeur || 0) / 100,
        hauteur: (r.item.hauteur || 0) / 100,
        nom: r.item.nom || "Sans nom",
        quantite: r.item.quantite || 1,
      }));

      // 🆕 Lancer l'algorithme de placement
      const packResult = shelfPack(plaquesInput, feuilleL_cm / 100, feuilleH_cm / 100, true);
      const stats = packStats(packResult, feuilleL_cm / 100, feuilleH_cm / 100);

      // Validation — plaques non placées
      if (packResult.unplaced.length > 0) {
        const names = packResult.unplaced.map((p) => `${p.nom} (${p.largeur}×${p.hauteur}cm)`).join(", ");
        setGroupWarning(
          `${packResult.unplaced.length} plaque(s) ne tiennent pas sur la feuille (${fmtM(feuilleL_cm / 100)}×${fmtM(feuilleH_cm / 100)}) : ${names}`,
        );
        // On crée quand même le groupe mais avec juste les plaques placées
      }

      const nbFeuilles = stats.nbFeuilles;

      // 🆕 Construire les FeuillePlacement[]
      const groupePlacements: FeuillePlacement[] = packResult.sheets.map((sheet, i) => ({
        feuille_index: i,
        placements: sheet.placements,
        chutes: sheet.chutes,
      }));

      // 🆕 Enfants : on garde les plaques originales + chutes totales (une entrée par feuille)
      const enfants: MaterialItem[] = selectedRows.map((r) => ({
        ...r.item,
        id: crypto.randomUUID?.() || `pla-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      }));

      // Chute totale (pour affichage dans la liste : une seule ligne "Chute" si >0)
      const surfaceOccupee = selectedRows.reduce(
        (sum, r) => sum + (r.item.largeur || 0) * (r.item.hauteur || 0) * (r.item.quantite || 1),
        0,
      );
      const chuteTotale = Math.max(0, nbFeuilles * feuilleL_cm * feuilleH_cm - surfaceOccupee);

      if (chuteTotale > 0.001) {
        enfants.push({
          id: crypto.randomUUID?.() || `chu-${Date.now()}`,
          nom: "Chute",
          quantite: 1,
          unite: "plaque",
          largeur: Math.round(Math.sqrt(chuteTotale) * 100) / 100,
          hauteur: Math.round(Math.sqrt(chuteTotale) * 100) / 100,
        } as MaterialItem);
      }

      const groupItem: MaterialItem = {
        id: crypto.randomUUID?.() || `grp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        nom: `${entry.materiau}${entry.epaisseur ? ` ${entry.epaisseur}` : ""}`,
        quantite: nbFeuilles,                                     // 🆕 dynamique
        unite: "Feuille",
        largeur: feuilleL_cm || undefined,
        hauteur: feuilleH_cm || undefined,
        epaisseur: entry.epaisseur || undefined,
        material_id: entry.id,
        format_standard: entry.format_standard || undefined,
        cout_unitaire: entry.cout_min ?? undefined,
        couleurs_dispo: entry.couleurs?.length ? entry.couleurs : undefined,
        groupe_enfants: enfants,
        groupe_material_id: entry.id,
        groupe_nom: `${entry.materiau}${entry.epaisseur ? ` ${entry.epaisseur}` : ""}`,
        groupe_format: entry.format_standard || undefined,
        groupe_largeur: feuilleL_cm || undefined,
        groupe_hauteur: feuilleH_cm || undefined,
        groupe_nb_feuilles_requis: nbFeuilles,                   // 🆕
        groupe_placements: groupePlacements,                      // 🆕
      };

      const idsToRemove = new Set(selectedIds);
      let filtered = rows.filter((r) => !(r.section === section && idsToRemove.has(r.item.id)));
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
      exitSelectionMode(section);
      setGroupDialogSection(null);
    },
    [rows, selectedIds, groupDialogSection, onRowsChange, exitSelectionMode],
  );

  const handleAddRow = useCallback(
    (section: string) => {
      const newItem: MaterialItem = {
        id: crypto.randomUUID?.() || `mat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        nom: "@",  // 🆕 Pré-rempli pour déclencher le dropdown catalogue
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
      setSelectedIds((prev) => {
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

  // Récupérer les noms des plaques sélectionnées pour le dialogue
  const selectedNames = useMemo(() => {
    return rows
      .filter((r) => selectedIds.has(r.item.id))
      .map((r) => r.item.nom || "Sans nom")
      .slice(0, 5);
  }, [rows, selectedIds]);

  const totalSelected = selectedIds.size;

  // 🆕 Trouver la première plaque sélectionnée pour "Sélectionner les mêmes"
  const firstSelected = useMemo(() => {
    if (totalSelected === 0) return null;
    const id = [...selectedIds][0];
    return rows.find(r => r.item.id === id) || null;
  }, [selectedIds, rows, totalSelected]);

  // 🆕 Compter combien de plaques ont le même matériau que la première sélectionnée
  const sameMaterialCount = useMemo(() => {
    if (!firstSelected) return 0;
    return rows.filter(r =>
      r.section === firstSelected.section &&
      !r.item.groupe_enfants &&
      r.item.nom === firstSelected.item.nom &&
      r.item.epaisseur === firstSelected.item.epaisseur
    ).length;
  }, [firstSelected, rows]);

  return (
    <div className="space-y-4">
      {/* 🆕 Indicateur de sélection active */}
      {totalSelected > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg text-xs">
          <div className="shrink-0 w-[14px] h-[14px] rounded-sm bg-indigo-500 flex items-center justify-center">
            <Check size={10} className="text-white" />
          </div>
          <span className="text-indigo-700 font-medium">
            {totalSelected} plaque{totalSelected > 1 ? "s" : ""} sélectionnée{totalSelected > 1 ? "s" : ""}
          </span>
          {/* 🆕 Sélectionner les mêmes */}
          {firstSelected && sameMaterialCount > totalSelected && (
            <button
              type="button"
              onClick={selectSameMaterial}
              className="text-[10px] text-indigo-500 hover:text-indigo-700 underline ml-1"
              title={`Sélectionner toutes les plaques "${firstSelected.item.nom}"`}
            >
              +{sameMaterialCount - totalSelected} mêmes
            </button>
          )}
          <button
            type="button"
            onClick={clearSelection}
            className="ml-auto text-gray-400 hover:text-red-500 p-0.5"
            title="Tout désélectionner"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {nonEmptySections.map((section) => {
        const sectionRows = grouped.get(section) || [];
        const canGroup = GROUPABLE_SECTIONS.includes(section);
        const inSelectionMode = selectionMode.has(section);
        const checkedInSection = sectionRows.filter(
          (r) => selectedIds.has(r.item.id) && !r.item.groupe_enfants,
        ).length;
        const selectableInSection = sectionRows.filter(r => !r.item.groupe_enfants).length;

        return (
          <div key={section} className="border border-gray-200 rounded-lg bg-white overflow-hidden">
            <div className={`flex items-center justify-between px-4 py-1.5 ${sectionBadge[section] || "bg-gray-50 text-gray-600"}`}>
              <div className="flex items-center gap-2">
                <span className="text-sm">{sectionIcon[section]}</span>
                <span className="text-xs font-semibold uppercase tracking-wide">{section}</span>
                <span className="text-[10px] opacity-50">({sectionRows.length})</span>

                {/* 🆕 Bouton mode sélection (Découpe/Vinyl uniquement) */}
                {canGroup && (
                  <button
                    type="button"
                    onClick={() => toggleSelectionMode(section)}
                    className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium transition-colors ${
                      inSelectionMode
                        ? "bg-indigo-500 text-white"
                        : "bg-white/60 text-gray-500 hover:bg-white hover:text-indigo-600 border border-gray-300/50"
                    }`}
                    title={inSelectionMode ? "Quitter le mode sélection" : "Activer le mode sélection"}
                  >
                    {inSelectionMode ? (
                      <div className="w-[11px] h-[11px] rounded-sm bg-indigo-500 flex items-center justify-center">
                        <Check size={8} className="text-white" />
                      </div>
                    ) : <Square size={11} />}
                    <span>{inSelectionMode ? `Sélection (${checkedInSection})` : "Sélectionner"}</span>
                  </button>
                )}

                {/* 🆕 Tout sélectionner — visible en mode sélection */}
                {inSelectionMode && selectableInSection > 0 && (
                  <button
                    type="button"
                    onClick={() => selectAllInSection(section)}
                    className="text-[10px] text-indigo-600 hover:text-indigo-800 font-medium"
                    title="Sélectionner toutes les plaques"
                  >
                    Tout
                  </button>
                )}
              </div>

              {/* 🆕 Bouton Feuille — apparaît quand ≥2 plaques cochées */}
              {canGroup && checkedInSection >= 2 && (
                <button
                  type="button"
                  onClick={() => { setGroupDialogSection(section); setGroupWarning(null); }}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-indigo-500 text-white hover:bg-indigo-600 font-bold transition-colors shadow-sm"
                >
                  <Layers size={13} />
                  <span className="font-normal">Feuille ({checkedInSection})</span>
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
                      // Props groupe
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
                      // 🆕 Swipe selection + mode sélection explicite
                      selectable={canGroup && !isGroup}
                      selectionMode={inSelectionMode}
                      selected={selectedIds.has(r.item.id)}
                      onToggleSelect={() => handleToggleSelect(r.item.id)}
                      // 🆕 Dissocier enfant
                      onDissocierEnfant={isGroup ? (ei: number) => handleDissocierEnfant(section, r.index, ei) : undefined}
                      // 🆕 Scroll sync
                      isActive={activeRowKey === `${enseigneId || "ens"}-${section}-${r.item.id}`}
                      onActivate={() => handleRowActivate(`${enseigneId || "ens"}-${section}-${r.item.id}`)}
                      // 🆕 Ouvrir aperçu au niveau page
                      onOpenPreview={isGroup ? () => onOpenPreview?.(section, r.index) : undefined}
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

      {/* 🆕 Dialogue groupage — portailé au document.body */}
      {groupDialogSection &&
        createPortal(
          <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
          onClick={() => setGroupDialogSection(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-visible animate-in zoom-in-95 fade-in duration-200"
          >
            {/* En-tête */}
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                <Layers size={18} className="text-indigo-500" />
                Créer un groupe — {groupDialogSection}
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                {totalSelected} plaque{totalSelected > 1 ? "s" : ""} → 1 feuille
              </p>
            </div>

            {/* Plaques sélectionnées */}
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
              <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-2">
                Plaques à grouper
              </p>
              <div className="flex flex-wrap gap-1.5">
                {selectedNames.map((name, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-white border border-gray-200 text-gray-700"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                    {name}
                  </span>
                ))}
                {rows.filter((r) => selectedIds.has(r.item.id)).length > 5 && (
                  <span className="text-xs text-gray-400 px-1">
                    +{rows.filter((r) => selectedIds.has(r.item.id)).length - 5} autres
                  </span>
                )}
              </div>
              <p className="text-[10px] text-gray-400 mt-2">
                Surface totale :{" "}
                <strong>
                  {rows
                    .filter((r) => selectedIds.has(r.item.id))
                    .reduce((s, r) => s + (r.item.largeur || 0) * (r.item.hauteur || 0) * (r.item.quantite || 1), 0)
                    .toFixed(2)} m²
                </strong>
              </p>
            </div>

            {/* 🆕 Warning validation */}
            {groupWarning && (
              <div className="px-5 py-2 bg-amber-50 border-b border-amber-100">
                <p className="text-xs text-amber-700">⚠️ {groupWarning}</p>
              </div>
            )}

            {/* Choix du matériau feuille */}
            <div className="px-5 py-4">
              <label className="block text-xs font-medium text-gray-600 mb-2">
                Choisir le matériau de la feuille
              </label>
              <MaterialSuggestions
                categorie={groupDialogSection}
                onSelect={handleConfirmGroup}
                placeholder={`Chercher dans ${groupDialogSection}…`}
              />
              <p className="text-[10px] text-gray-400 mt-2">
                Tous les matériaux de la section sont éligibles. Leurs dimensions serviront de dimensions de feuille.
              </p>
            </div>

            {/* Actions */}
            <div className="px-5 py-3 border-t border-gray-100 flex gap-2 justify-end">
              <button
                onClick={() => {
                  setGroupDialogSection(null);
                  clearSelection();
                }}
                className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default CdcBuilderTable;
