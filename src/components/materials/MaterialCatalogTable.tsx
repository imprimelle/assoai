// src/components/materials/MaterialCatalogTable.tsx
import React from "react";
import { Pencil, Trash2 } from "lucide-react";
import { formatCFA } from "@/utils/format";
import { MaterialCatalogEntry } from "@/types/materialCatalog";
import { styleFor, fieldsForCategory } from "./materialFields";

interface Props {
  materials: MaterialCatalogEntry[];
  onView: (m: MaterialCatalogEntry) => void;
  onEdit: (m: MaterialCatalogEntry) => void;
  onDelete: (id: string) => void;
}

const MaterialCatalogTable: React.FC<Props> = ({ materials, onView, onEdit, onDelete }) => {
  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
      <table className="w-full text-sm min-w-[680px]">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
            <th className="px-4 py-3 font-medium">Matériau</th>
            <th className="px-3 py-3 font-medium">Catégorie</th>
            <th className="px-3 py-3 font-medium">Format</th>
            <th className="px-3 py-3 font-medium">Détails</th>
            <th className="px-3 py-3 font-medium text-right">Prix</th>
            <th className="px-3 py-3 font-medium w-16"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {materials.map((m) => {
            const st = styleFor(m.categorie);
            const fields = fieldsForCategory(m.categorie);
            const spec = m.epaisseur || m.puissance_volt || "";
            const showColors = fields.includes("couleurs") && m.couleurs.length > 0;
            const price =
              m.cout_min != null
                ? m.cout_max != null && m.cout_max !== m.cout_min
                  ? `${formatCFA(m.cout_min)} – ${formatCFA(m.cout_max)}`
                  : formatCFA(m.cout_min)
                : "—";
            return (
              <tr
                key={m.id}
                onClick={() => onView(m)}
                className="group cursor-pointer hover:bg-gray-50/70 transition-colors"
              >
                {/* Matériau */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${st.iconBg}`}>
                      {st.icon}
                    </span>
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 truncate">{m.materiau}</div>
                      {spec && <div className="text-xs text-gray-400">{spec}</div>}
                    </div>
                  </div>
                </td>
                {/* Catégorie */}
                <td className="px-3 py-3">
                  <span className={`text-[10px] font-medium rounded-full px-2 py-0.5 ${st.badge}`}>
                    {m.categorie}
                  </span>
                </td>
                {/* Format */}
                <td className="px-3 py-3 text-gray-600 text-xs max-w-[180px]">
                  <span className="line-clamp-2">{m.format_standard || "—"}</span>
                </td>
                {/* Détails */}
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1">
                    {m.etancheite && (
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 rounded-full px-2 py-0.5">
                        {m.etancheite}
                      </span>
                    )}
                    {m.indications && (
                      <span className="text-[10px] bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">
                        {m.indications}
                      </span>
                    )}
                    {showColors && (
                      <span className={`text-[10px] rounded-full px-2 py-0.5 ${st.chip}`}>
                        {m.couleurs.length} couleur{m.couleurs.length !== 1 ? "s" : ""}
                      </span>
                    )}
                    {!m.etancheite && !m.indications && !showColors && (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </div>
                </td>
                {/* Prix */}
                <td className="px-3 py-3 text-right whitespace-nowrap">
                  <div className="font-semibold text-gray-900">{price}</div>
                  <div className="text-[11px] text-gray-400">/ {m.unite || "unité"}</div>
                </td>
                {/* Actions */}
                <td className="px-3 py-3">
                  <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); onEdit(m); }}
                      className="h-7 w-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-800 hover:bg-white"
                      aria-label="Modifier"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(m.id); }}
                      className="h-7 w-7 rounded-lg border border-gray-200 flex items-center justify-center text-red-500 hover:bg-red-50"
                      aria-label="Supprimer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default MaterialCatalogTable;
