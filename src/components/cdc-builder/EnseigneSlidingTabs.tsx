// src/components/cdc-builder/EnseigneSlidingTabs.tsx
// Barre d'onglets horizontale scrollable — switch d'enseigne active.
// Chaque onglet = nom + dimensions résumées. Boutons ajout/suppression/édition.

import React, { useRef } from "react";
import { Plus, X } from "lucide-react";
import type { CdcBuilderEnseigne } from "@/types/cdcBuilder";

export interface EnseigneSlidingTabsProps {
  enseignes: CdcBuilderEnseigne[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onDelete: (index: number) => void;
  onEdit: (index: number) => void;
}

const EnseigneSlidingTabs: React.FC<EnseigneSlidingTabsProps> = ({
  enseignes,
  activeIndex,
  onSelect,
  onAdd,
  onDelete,
  onEdit,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const fmtDim = (ens: CdcBuilderEnseigne) => {
    const { largeur, hauteur } = ens.dimensions;
    if (largeur && hauteur) return `${largeur}×${hauteur}`;
    return "—";
  };

  return (
    <div className="space-y-3">
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
        Enseignes
      </div>

      {/* Barre d'onglets scrollable */}
      <div
        ref={scrollRef}
        className="flex items-center gap-1 overflow-x-auto pb-1
                   scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent"
        style={{ scrollbarWidth: "thin" }}
      >
        {enseignes.map((ens, idx) => {
          const isActive = idx === activeIndex;
          return (
            <div key={ens.id} className="relative shrink-0 group">
              <button
                type="button"
                onClick={() => onSelect(idx)}
                onDoubleClick={() => onEdit(idx)}
                className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium
                  transition-colors whitespace-nowrap select-none
                  ${isActive
                    ? "bg-indigo-600 text-white shadow-md"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                title="Double-clic pour éditer"
              >
                <span className="text-xs opacity-70">🏷️</span>
                <span className="max-w-[140px] truncate">{ens.nom}</span>
                <span className="text-xs opacity-60">{fmtDim(ens)}cm</span>
              </button>

              {/* Bouton ✕ (sauf si 1 seule enseigne) */}
              {enseignes.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(idx);
                  }}
                  className={`absolute -top-1 -right-1 w-5 h-5 rounded-full
                    flex items-center justify-center text-xs
                    transition-opacity
                    ${isActive
                      ? "bg-white text-indigo-600 hover:bg-red-100 hover:text-red-600"
                      : "bg-gray-300 text-gray-600 opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-600"
                    }`}
                  title="Supprimer cette enseigne"
                >
                  <X size={11} />
                </button>
              )}
            </div>
          );
        })}

        {/* Bouton [+ Ajouter] */}
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-1 px-3 py-2 rounded-t-lg text-sm font-medium
                     bg-gray-50 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600
                     border border-dashed border-gray-300 hover:border-indigo-300
                     transition-colors shrink-0"
        >
          <Plus size={14} />
          <span className="whitespace-nowrap">Ajouter</span>
        </button>
      </div>
    </div>
  );
};

export default EnseigneSlidingTabs;
