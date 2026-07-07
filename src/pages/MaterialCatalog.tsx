// src/pages/MaterialCatalog.tsx
import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Boxes, PlusCircle, Search } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { useMaterials } from "@/hooks/useMaterials";
import { MaterialCatalogList, MaterialCatalogModal } from "@/components/materials";
import { MaterialModalMode } from "@/components/materials/MaterialCatalogModal";
import {
  MaterialCatalogEntry,
  MaterialCatalogFormData,
  MATERIAL_CATEGORIES,
} from "@/types/materialCatalog";

const MaterialCatalog: React.FC = () => {
  const [search, setSearch] = useState("");
  const [categorie, setCategorie] = useState<string>("ALL");
  const debouncedSearch = useDebounce(search, 400);

  const { materials, isLoading, createMaterial, updateMaterial, deleteMaterial } =
    useMaterials(debouncedSearch, categorie);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<MaterialModalMode>("create");
  const [selected, setSelected] = useState<MaterialCatalogEntry | null>(null);

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const openCreate = () => {
    setSelected(null);
    setModalMode("create");
    setModalOpen(true);
  };
  const openEdit = (m: MaterialCatalogEntry) => {
    setSelected(m);
    setModalMode("edit");
    setModalOpen(true);
  };
  const openView = (m: MaterialCatalogEntry) => {
    setSelected(m);
    setModalMode("view");
    setModalOpen(true);
  };

  const handleSubmit = async (data: MaterialCatalogFormData) => {
    if (modalMode === "create") {
      await createMaterial(data);
    } else if (modalMode === "edit" && selected) {
      await updateMaterial(selected.id, data);
    }
  };

  const handleConfirmDelete = async () => {
    if (deleteId) {
      await deleteMaterial(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50/40 via-white to-orange-50/30">
      <div className="container mx-auto py-8 px-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-amber-100 p-2 rounded-full">
              <Boxes className="h-7 w-7 text-amber-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Matériaux</h1>
              <p className="text-sm text-gray-500">Catalogue des matières premières</p>
            </div>
          </div>
          <Button onClick={openCreate} className="flex items-center gap-2">
            <PlusCircle className="h-4 w-4" /> Nouveau matériau
          </Button>
        </div>

        {/* Filtres */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un matériau…"
              className="pl-9 h-10"
            />
          </div>
          <Select value={categorie} onValueChange={setCategorie}>
            <SelectTrigger className="h-10 w-full sm:w-56">
              <SelectValue placeholder="Catégorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Toutes les catégories</SelectItem>
              {MATERIAL_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <MaterialCatalogList
          materials={materials}
          isLoading={isLoading}
          onView={openView}
          onEdit={openEdit}
          onDelete={(id) => setDeleteId(id)}
        />

        <MaterialCatalogModal
          key={`${modalMode}-${selected?.id || "new"}`}
          isOpen={modalOpen}
          mode={modalMode}
          material={selected}
          onClose={() => setModalOpen(false)}
          onSubmit={handleSubmit}
        />

        <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
          <AlertDialogContent className="bg-white rounded-lg shadow-lg">
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
              <AlertDialogDescription>
                Êtes-vous sûr de vouloir supprimer ce matériau ? Cette action est irréversible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-white">Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                className="bg-red-600 hover:bg-red-700"
              >
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default MaterialCatalog;
