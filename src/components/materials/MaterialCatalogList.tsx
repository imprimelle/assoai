// src/components/materials/MaterialCatalogList.tsx
import React from "react";
import { Loader2, Package } from "lucide-react";
import MaterialCatalogCard from "./MaterialCatalogCard";
import { MaterialCatalogEntry } from "@/types/materialCatalog";

interface Props {
  materials: MaterialCatalogEntry[];
  isLoading: boolean;
  onView: (m: MaterialCatalogEntry) => void;
  onEdit: (m: MaterialCatalogEntry) => void;
  onDelete: (id: string) => void;
}

const MaterialCatalogList: React.FC<Props> = ({
  materials,
  isLoading,
  onView,
  onEdit,
  onDelete,
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Chargement des matériaux…
      </div>
    );
  }

  if (materials.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <Package className="h-10 w-10 mb-2" />
        <p className="text-sm">Aucun matériau dans le catalogue.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {materials.map((m) => (
        <MaterialCatalogCard
          key={m.id}
          material={m}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
};

export default MaterialCatalogList;
