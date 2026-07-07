// src/components/materials/MaterialCatalogCard.tsx
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Package } from "lucide-react";
import { formatCFA } from "@/utils/format";
import { MaterialCatalogEntry } from "@/types/materialCatalog";

interface Props {
  material: MaterialCatalogEntry;
  onView: (m: MaterialCatalogEntry) => void;
  onEdit: (m: MaterialCatalogEntry) => void;
  onDelete: (id: string) => void;
}

const MaterialCatalogCard: React.FC<Props> = ({ material, onView, onEdit, onDelete }) => {
  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div
          className="flex items-start gap-3 cursor-pointer"
          onClick={() => onView(material)}
        >
          <div className="h-12 w-12 rounded-md bg-amber-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {material.image_url ? (
              <img src={material.image_url} alt={material.materiau} className="h-full w-full object-cover" />
            ) : (
              <Package className="h-6 w-6 text-amber-600" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-gray-900 truncate">
              {material.materiau}
              {material.epaisseur
                ? ` — ${material.epaisseur}`
                : material.puissance_volt
                  ? ` — ${material.puissance_volt}`
                  : ""}
            </h3>
            <p className="text-xs text-gray-500">
              <span className="inline-block bg-gray-100 rounded px-1.5 py-0.5 mr-1">
                {material.categorie}
              </span>
              {material.format_standard || ""}
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {material.couleurs.slice(0, 4).map((c) => (
                <span key={c} className="text-[10px] bg-blue-50 text-blue-700 rounded px-1.5 py-0.5">
                  {c}
                </span>
              ))}
              {material.couleurs.length > 4 && (
                <span className="text-[10px] text-gray-400">+{material.couleurs.length - 4}</span>
              )}
            </div>
            {(material.etancheite || material.indications) && (
              <div className="mt-1 flex flex-wrap gap-1">
                {material.etancheite && (
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 rounded px-1.5 py-0.5">
                    {material.etancheite}
                  </span>
                )}
                {material.indications && (
                  <span className="text-[10px] bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">
                    {material.indications}
                  </span>
                )}
              </div>
            )}
            {(material.cout_min != null || material.cout_max != null) && (
              <p className="mt-1 text-xs font-medium text-gray-700">
                {formatCFA(material.cout_min ?? 0)}
                {material.cout_max != null && material.cout_max !== material.cout_min
                  ? ` – ${formatCFA(material.cout_max)}`
                  : ""}
                <span className="text-gray-400"> / {material.unite}</span>
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-1 mt-2 border-t pt-2">
          <Button variant="ghost" size="sm" onClick={() => onEdit(material)} className="h-8 px-2">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(material.id)}
            className="h-8 px-2 text-red-500 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default MaterialCatalogCard;
