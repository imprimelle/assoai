// src/components/cdc-builder/MaterialCell.tsx
// Input éditable avec déclencheur @ → recherche catalogue matériaux.
// v3: onCatalogSelect passe l'entry complète pour le routage section.

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Package, X, Loader2 } from "lucide-react";
import { useMaterials } from "@/hooks/useMaterials";
import { formatCFA } from "@/utils/format";
import type { MaterialItem } from "@/types";
import type { MaterialCatalogEntry } from "@/types/materialCatalog";

// --- Mapping canonique ---
const catalogToMaterialItem = (
  entry: MaterialCatalogEntry,
): Partial<MaterialItem> => ({
  nom: `${entry.materiau}${entry.epaisseur ? ` ${entry.epaisseur}` : ""}`,
  unite: entry.unite,
  epaisseur: entry.epaisseur || undefined,
  largeur: entry.largeur_std ?? undefined,
  hauteur: entry.hauteur_std ?? undefined,
  reference: entry.external_id != null ? String(entry.external_id) : undefined,
  material_id: entry.id,
  format_standard: entry.format_standard || undefined,
  cout_unitaire: entry.cout_min ?? undefined,
  couleurs_dispo: entry.couleurs.length ? entry.couleurs : undefined,
});

// --- Props ---
export interface MaterialCellProps {
  value: string;
  onChange: (nom: string) => void;
  /** preset + entry complète pour permettre le routage section */
  onCatalogSelect: (preset: Partial<MaterialItem>, entry: MaterialCatalogEntry) => void;
  onClear: () => void;
  disabled?: boolean;
}

const MaterialCell: React.FC<MaterialCellProps> = ({
  value,
  onChange,
  onCatalogSelect,
  onClear,
  disabled = false,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [atQuery, setAtQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { materials, isLoading } = useMaterials(atQuery);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      onChange(raw);

      const atIdx = raw.lastIndexOf("@");
      if (atIdx >= 0) {
        const term = raw.slice(atIdx + 1);
        setAtQuery(term);
        setShowDropdown(true);
        setActiveIdx(0);
      } else {
        setShowDropdown(false);
        setAtQuery("");
      }
    },
    [onChange],
  );

  const handleSelect = useCallback(
    (entry: MaterialCatalogEntry) => {
      const preset = catalogToMaterialItem(entry);
      onCatalogSelect(preset, entry);
      setShowDropdown(false);
    },
    [onChange, onCatalogSelect],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!showDropdown || materials.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((prev) => Math.min(prev + 1, materials.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (materials[activeIdx]) handleSelect(materials[activeIdx]);
      } else if (e.key === "Escape") {
        setShowDropdown(false);
      }
    },
    [showDropdown, materials, activeIdx, handleSelect],
  );

  useEffect(() => {
    if (!showDropdown) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showDropdown]);

  useEffect(() => {
    if (!showDropdown || materials.length === 0) return;
    const el = document.getElementById(`mat-cell-opt-${materials[activeIdx]?.id}`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [activeIdx, showDropdown, materials]);

  const hasValue = value.trim().length > 0;

  return (
    <div ref={wrapperRef} className="relative min-w-[180px]">
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            const atIdx = value.lastIndexOf("@");
            if (atIdx >= 0) {
              setAtQuery(value.slice(atIdx + 1));
              setShowDropdown(true);
            }
          }}
          disabled={disabled}
          placeholder="@ pour chercher dans le catalogue…"
          className="h-9 w-full border border-gray-200 rounded px-2 pr-8 bg-white text-sm
                     focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none
                     disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
        {hasValue && !disabled && (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-1 top-1/2 -translate-y-1/2 p-1
                       text-gray-400 hover:text-red-500 transition-colors"
            title="Effacer"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute z-[100] mt-1 w-[320px] max-w-[90vw] bg-white border border-gray-200
                     rounded-lg shadow-xl max-h-64 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-gray-400">
              <Loader2 size={14} className="animate-spin" /> Recherche…
            </div>
          ) : materials.length === 0 ? (
            <div className="px-3 py-3 text-sm text-gray-400">
              {atQuery.length > 0
                ? `Aucun matériau trouvé pour « ${atQuery} »`
                : "Tapez pour rechercher un matériau…"}
            </div>
          ) : (
            <ul className="py-1">
              {materials.map((entry, idx) => {
                const cost = entry.cout_min != null
                  ? ` • ${formatCFA(entry.cout_min)}/${entry.unite}` : "";
                const colors = entry.couleurs.length
                  ? ` • ${entry.couleurs.join(", ")}` : "";
                const subtitle = `${entry.format_standard || entry.categorie}${colors}${cost}`;
                return (
                  <li
                    key={entry.id}
                    id={`mat-cell-opt-${entry.id}`}
                    role="option"
                    aria-selected={idx === activeIdx}
                    onClick={() => handleSelect(entry)}
                    onMouseEnter={() => setActiveIdx(idx)}
                    className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-sm transition-colors
                      ${idx === activeIdx ? "bg-indigo-50 text-indigo-900" : "text-gray-700 hover:bg-gray-50"}`}
                  >
                    <Package size={14} className={idx === activeIdx ? "text-indigo-500 shrink-0" : "text-amber-500 shrink-0"} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {entry.materiau}{entry.epaisseur ? ` ${entry.epaisseur}` : ""}
                      </div>
                      {subtitle && <div className="text-xs text-gray-400 truncate">{subtitle}</div>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default MaterialCell;
