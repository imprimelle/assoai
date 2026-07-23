// src/components/cdc-builder/CdcBuilderRow.tsx
// Ligne éditable inline du tableau CDC Builder — 3 colonnes adaptatives par section.
// v4: scrollbar subtile, bouton suppression retiré (géré par poubelle ligne entière).

import React from "react";
import { Trash2 } from "lucide-react";
import MaterialCell from "./MaterialCell";
import {
  UNITES,
  COULEURS,
  EPAISSEURS,
  withCurrent,
} from "@/constants/materials";
import type { MaterialItem } from "@/types";
import type { FlatMaterialRow } from "@/components/templates/shared/MaterialTable";
import type { MaterialCatalogEntry } from "@/types/materialCatalog";

// --- Règles de visibilité ---
const showHauteur = (section: string) =>
  ["Découpe", "Vinyl"].includes(section);
const showCouleur = (section: string, item: MaterialItem) =>
  ["Éclairage", "Vinyl", "Découpe"].includes(section) ||
  (item.couleurs_dispo && item.couleurs_dispo.length > 0);
const showEpaisseur = (section: string) =>
  ["Métal", "Découpe"].includes(section);

// --- Props ---
export interface CdcBuilderRowProps {
  row: FlatMaterialRow;
  defaultDimensions: { largeur: number; hauteur: number };
  onChange: (changes: Partial<MaterialItem>) => void;
  onDelete: () => void;
  /** Appelé quand un matériau catalogue est sélectionné mais sa catégorie ≠ section courante */
  onMoveToSection?: (targetSection: string, preset: Partial<MaterialItem>, entry: MaterialCatalogEntry) => void;
  disabled?: boolean;
  /** Badge optionnel affiché avant le nom du matériau (ex: nom de l'enseigne en vue consolidée) */
  enseigneBadge?: { nom: string; color?: string };
  /** Type de highlight pour animation flash après action Brico */
  flashType?: "added" | "modified";
  /** ID de l'enseigne propriétaire — utilisé pour la clé de scroll / highlight */
  enseigneId?: string;
}

const CdcBuilderRow: React.FC<CdcBuilderRowProps> = ({
  row,
  defaultDimensions,
  onChange,
  onDelete,
  onMoveToSection,
  disabled = false,
  enseigneBadge,
  flashType,
  enseigneId,
}) => {
  const { section, item } = row;

  const handleNum = (
    field: "quantite" | "largeur" | "hauteur",
    raw: string,
  ) => {
    if (raw === "") {
      onChange({ [field]: field === "quantite" ? 1 : 0 });
      return;
    }
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) return;
    onChange({ [field]: Math.max(0, parsed) });
  };

  /** Sélection catalogue : si la catégorie matériau ≠ section, router */
  const handleCatalogSelect = (preset: Partial<MaterialItem>, entry: MaterialCatalogEntry) => {
    if (entry.categorie && entry.categorie !== section && onMoveToSection) {
      onMoveToSection(entry.categorie, preset, entry);
    } else {
      onChange(preset);
    }
  };

  const cellInput =
    "h-9 border border-gray-200 rounded px-2 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none";

  return (
    <div
      data-highlight-key={enseigneId ? `${enseigneId}-${section}-${row.index}` : undefined}
      className={`overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 py-2 border-b border-gray-100 last:border-b-0 scrollbar-subtle ${
        flashType ? `flash-${flashType}` : ""
      }`}
    >
      <div className="flex items-center gap-2 min-w-[620px] md:min-w-0">
        {/* Colonne 1 : Matériau */}
        <div className="w-[200px] shrink-0">
          {enseigneBadge && (
            <span
              className="inline-block text-[10px] px-1.5 py-0.5 rounded-full font-medium mb-1 truncate max-w-full"
              style={{
                backgroundColor: enseigneBadge.color ? `${enseigneBadge.color}20` : '#EEF2FF',
                color: enseigneBadge.color || '#4F46E5',
                border: `1px solid ${enseigneBadge.color ? `${enseigneBadge.color}40` : '#C7D2FE'}`,
              }}
              title={enseigneBadge.nom}
            >
              🏷️ {enseigneBadge.nom}
            </span>
          )}
          <MaterialCell
            value={item.nom}
            onChange={(nom) => onChange({ nom })}
            onCatalogSelect={handleCatalogSelect}
            onClear={() => onChange({ nom: "" })}
            disabled={disabled}
          />
        </div>

        {/* Colonne 2 : Paramètres — Qté en premier */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Qté — discret, en premier */}
          <div className="flex items-center gap-0.5">
            <span className="text-[10px] text-gray-300">×</span>
            <input type="number" inputMode="decimal" min={1}
              value={item.quantite ?? 1}
              onChange={(e) => handleNum("quantite", e.target.value)}
              disabled={disabled}
              className={`${cellInput} w-[44px] text-center tabular-nums text-xs`} />
          </div>

          <div className="flex items-center gap-0.5">
            <span className="text-[10px] text-gray-300 w-2">L</span>
            <input type="number" inputMode="decimal" min={0} step={0.1}
              value={item.largeur ?? ""} placeholder={String(defaultDimensions.largeur)}
              onChange={(e) => handleNum("largeur", e.target.value)}
              disabled={disabled}
              className={`${cellInput} w-[52px] text-center tabular-nums text-xs`} />
          </div>

          {showHauteur(section) ? (
            <div className="flex items-center gap-0.5">
              <span className="text-[10px] text-gray-300 w-2">H</span>
              <input type="number" inputMode="decimal" min={0} step={0.1}
                value={item.hauteur ?? ""} placeholder={String(defaultDimensions.hauteur)}
                onChange={(e) => handleNum("hauteur", e.target.value)}
                disabled={disabled}
                className={`${cellInput} w-[52px] text-center tabular-nums text-xs`} />
            </div>
          ) : (
            <span className="text-gray-300 text-xs w-[52px] text-center">—</span>
          )}

          <input list={`unite-cdc-${item.id}`} value={item.unite || ""}
            onChange={(e) => onChange({ unite: e.target.value })}
            disabled={disabled}
            className={`${cellInput} w-[72px] text-xs`} placeholder="unité" />
          <datalist id={`unite-cdc-${item.id}`}>
            {withCurrent(UNITES, item.unite).map((u) => <option key={u} value={u} />)}
          </datalist>
        </div>

        {/* Colonne 3 : Détails */}
        <div className="flex items-center gap-2 shrink-0">
          {showEpaisseur(section) ? (
            <select value={item.epaisseur || ""}
              onChange={(e) => onChange({ epaisseur: e.target.value })}
              disabled={disabled}
              className="h-9 rounded-md border border-gray-200 bg-white px-2 text-sm focus:ring-2 focus:ring-indigo-500 w-[110px]">
              <option value="">Épaisseur</option>
              {withCurrent(EPAISSEURS, item.epaisseur).map((ep) => <option key={ep} value={ep}>{ep}</option>)}
            </select>
          ) : (
            <span className="text-gray-300 text-sm w-[110px] text-center">—</span>
          )}

          {showCouleur(section, item) ? (
            <select value={item.couleur || ""}
              onChange={(e) => onChange({ couleur: e.target.value })}
              disabled={disabled}
              className="h-9 rounded-md border border-gray-200 bg-white px-2 text-sm focus:ring-2 focus:ring-indigo-500 w-[130px]">
              <option value="">Couleur</option>
              {withCurrent(
                item.couleurs_dispo?.length ? item.couleurs_dispo : COULEURS,
                item.couleur,
              ).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          ) : null}

          {!disabled && (
            <button type="button" onClick={onDelete}
              className="text-red-400 hover:text-red-600 p-1 transition-colors shrink-0"
              title="Supprimer cette ligne">
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CdcBuilderRow;
