// src/components/cdc-builder/CdcBuilderRow.tsx
// Ligne éditable inline du tableau CDC Builder — 3 colonnes adaptatives par section.
// Réutilise MaterialCell, les constantes canoniques, et le type FlatMaterialRow.

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

// --- Règles de visibilité (identiques à MaterialTable.tsx:54-58) ---
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
  disabled?: boolean;
}

const CdcBuilderRow: React.FC<CdcBuilderRowProps> = ({
  row,
  defaultDimensions,
  onChange,
  onDelete,
  disabled = false,
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

  const cellInput =
    "h-9 border border-gray-200 rounded px-2 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none";

  const displayL =
    item.largeur || defaultDimensions.largeur;
  const displayH =
    item.hauteur || defaultDimensions.hauteur;

  return (
    <div className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-b-0">
      {/* Colonne 1 : Matériau (MaterialCell) */}
      <div className="flex-1 min-w-0">
        <MaterialCell
          value={item.nom}
          onChange={(nom) => onChange({ nom })}
          onCatalogSelect={(preset) => onChange(preset)}
          onClear={() => onChange({ nom: "" })}
          disabled={disabled}
        />
      </div>

      {/* Colonne 2 : Paramètres (L, H, Qté) */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-400">L</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step={0.1}
            value={item.largeur ?? ""}
            placeholder={String(defaultDimensions.largeur)}
            onChange={(e) => handleNum("largeur", e.target.value)}
            disabled={disabled}
            className={`${cellInput} w-16 text-center tabular-nums`}
          />
        </div>

        {showHauteur(section) ? (
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-400">H</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step={0.1}
              value={item.hauteur ?? ""}
              placeholder={String(defaultDimensions.hauteur)}
              onChange={(e) => handleNum("hauteur", e.target.value)}
              disabled={disabled}
              className={`${cellInput} w-16 text-center tabular-nums`}
            />
          </div>
        ) : (
          <span className="text-gray-300 text-sm w-16 text-center">—</span>
        )}

        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-400">×</span>
          <input
            type="number"
            inputMode="decimal"
            min={1}
            value={item.quantite ?? 1}
            onChange={(e) => handleNum("quantite", e.target.value)}
            disabled={disabled}
            className={`${cellInput} w-14 text-center tabular-nums`}
          />
        </div>

        {/* Unité */}
        <input
          list={`unite-cdc-${item.id}`}
          value={item.unite || ""}
          onChange={(e) => onChange({ unite: e.target.value })}
          disabled={disabled}
          className={`${cellInput} w-20`}
          placeholder="unité"
        />
        <datalist id={`unite-cdc-${item.id}`}>
          {withCurrent(UNITES, item.unite).map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
      </div>

      {/* Colonne 3 : Détails (Épaisseur, Couleur) */}
      <div className="flex items-center gap-2 shrink-0">
        {showEpaisseur(section) ? (
          <select
            value={item.epaisseur || ""}
            onChange={(e) => onChange({ epaisseur: e.target.value })}
            disabled={disabled}
            className="h-9 rounded-md border border-gray-200 bg-white px-2 text-sm focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Épaisseur</option>
            {withCurrent(EPAISSEURS, item.epaisseur).map((ep) => (
              <option key={ep} value={ep}>
                {ep}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-gray-300 text-sm w-24 text-center">—</span>
        )}

        {showCouleur(section, item) ? (
          <select
            value={item.couleur || ""}
            onChange={(e) => onChange({ couleur: e.target.value })}
            disabled={disabled}
            className="h-9 rounded-md border border-gray-200 bg-white px-2 text-sm focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Couleur</option>
            {withCurrent(
              item.couleurs_dispo && item.couleurs_dispo.length > 0
                ? item.couleurs_dispo
                : COULEURS,
              item.couleur,
            ).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        ) : null}

        {/* Supprimer */}
        {!disabled && (
          <button
            type="button"
            onClick={onDelete}
            className="text-red-400 hover:text-red-600 p-1 transition-colors"
            title="Supprimer cette ligne"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
};

export default CdcBuilderRow;
