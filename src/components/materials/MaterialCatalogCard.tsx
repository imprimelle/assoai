// src/components/materials/MaterialCatalogCard.tsx
import React from "react";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Ruler } from "lucide-react";
import { formatCFA } from "@/utils/format";
import { MaterialCatalogEntry } from "@/types/materialCatalog";
import { styleFor, fieldsForCategory } from "./materialFields";

interface Props {
  material: MaterialCatalogEntry;
  onView: (m: MaterialCatalogEntry) => void;
  onEdit: (m: MaterialCatalogEntry) => void;
  onDelete: (id: string) => void;
}

const MaterialCatalogCard: React.FC<Props> = ({ material, onView, onEdit, onDelete }) => {
  const style = styleFor(material.categorie);
  const fields = fieldsForCategory(material.categorie);
  const showColors = fields.includes("couleurs") && material.couleurs.length > 0;

  // Spec distinctive dans le titre (épaisseur ou puissance selon la catégorie)
  const titleSpec = material.epaisseur || material.puissance_volt || "";

  const price =
    material.cout_min != null
      ? material.cout_max != null && material.cout_max !== material.cout_min
        ? `${formatCFA(material.cout_min)} – ${formatCFA(material.cout_max)}`
        : formatCFA(material.cout_min)
      : null;

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
      {/* Bandeau d'accent catégorie */}
      <div className={`h-1 w-full bg-gradient-to-r ${style.gradient}`} />

      <div className="p-4 cursor-pointer" onClick={() => onView(material)}>
        <div className="flex items-start gap-3">
          <div className={`h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden ${style.iconBg}`}>
            {material.image_url ? (
              <img src={material.image_url} alt={material.materiau} className="h-full w-full object-cover" />
            ) : (
              style.icon
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-gray-900 leading-tight">
                {material.materiau}
                {titleSpec && <span className="text-gray-400 font-normal"> · {titleSpec}</span>}
              </h3>
              <span className={`shrink-0 text-[10px] font-medium rounded-full px-2 py-0.5 ${style.badge}`}>
                {material.categorie}
              </span>
            </div>

            {material.format_standard && (
              <p className="mt-1 text-xs text-gray-500 flex items-center gap-1">
                <Ruler className="h-3 w-3 shrink-0" />
                <span className="truncate">{material.format_standard}</span>
              </p>
            )}

            {/* Chips adaptatifs */}
            <div className="mt-2 flex flex-wrap gap-1">
              {material.etancheite && (
                <span className="text-[10px] bg-emerald-50 text-emerald-700 rounded-full px-2 py-0.5">
                  {material.etancheite}
                </span>
              )}
              {material.indications && (
                <span className="text-[10px] bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">
                  {material.indications}
                </span>
              )}
              {showColors &&
                material.couleurs.slice(0, 3).map((c) => (
                  <span key={c} className={`text-[10px] rounded-full px-2 py-0.5 ${style.chip}`}>
                    {c}
                  </span>
                ))}
              {showColors && material.couleurs.length > 3 && (
                <span className="text-[10px] text-gray-400 px-1">+{material.couleurs.length - 3}</span>
              )}
            </div>
          </div>
        </div>

        {/* Prix */}
        {price && (
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-base font-bold text-gray-900">{price}</span>
            <span className="text-xs text-gray-400">/ {material.unite || "unité"}</span>
          </div>
        )}
      </div>

      {/* Actions au survol */}
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(material); }}
          className="h-7 w-7 rounded-lg bg-white/90 border border-gray-200 shadow-sm flex items-center justify-center text-gray-500 hover:text-gray-800"
          aria-label="Modifier"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(material.id); }}
          className="h-7 w-7 rounded-lg bg-white/90 border border-gray-200 shadow-sm flex items-center justify-center text-red-500 hover:bg-red-50"
          aria-label="Supprimer"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};

export default MaterialCatalogCard;
