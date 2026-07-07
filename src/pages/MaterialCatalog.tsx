// src/pages/MaterialCatalog.tsx
import React, { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
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
import { useMaterials } from "@/hooks/useMaterials";
import { MaterialCatalogList, MaterialCatalogModal } from "@/components/materials";
import { MaterialModalMode } from "@/components/materials/MaterialCatalogModal";
import { styleFor } from "@/components/materials/materialFields";
import { normalizeText } from "@/utils/productSearch";
import {
  MaterialCatalogEntry,
  MaterialCatalogFormData,
  MATERIAL_CATEGORIES,
} from "@/types/materialCatalog";

const MaterialCatalog: React.FC = () => {
  const [search, setSearch] = useState("");
  const [categorie, setCategorie] = useState<string>("ALL");

  // On charge tout une fois et on filtre côté client (52 lignes → instantané + compteurs pilules)
  const { materials, isLoading, createMaterial, updateMaterial, deleteMaterial } =
    useMaterials("", "ALL");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<MaterialModalMode>("create");
  const [selected, setSelected] = useState<MaterialCatalogEntry | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    materials.forEach((m) => (c[m.categorie] = (c[m.categorie] || 0) + 1));
    return c;
  }, [materials]);

  const filtered = useMemo(() => {
    const q = normalizeText(search);
    return materials.filter((m) => {
      if (categorie !== "ALL" && m.categorie !== categorie) return false;
      if (!q) return true;
      return (
        normalizeText(m.materiau).includes(q) ||
        normalizeText(m.format_standard || "").includes(q) ||
        normalizeText(m.epaisseur || "").includes(q)
      );
    });
  }, [materials, categorie, search]);

  const openCreate = () => { setSelected(null); setModalMode("create"); setModalOpen(true); };
  const openEdit = (m: MaterialCatalogEntry) => { setSelected(m); setModalMode("edit"); setModalOpen(true); };
  const openView = (m: MaterialCatalogEntry) => { setSelected(m); setModalMode("view"); setModalOpen(true); };

  const handleSubmit = async (data: MaterialCatalogFormData) => {
    if (modalMode === "create") await createMaterial(data);
    else if (modalMode === "edit" && selected) await updateMaterial(selected.id, data);
  };

  const handleConfirmDelete = async () => {
    if (deleteId) { await deleteMaterial(deleteId); setDeleteId(null); }
  };

  const pill = (key: string, label: string, n: number) => {
    const active = categorie === key;
    const st = key !== "ALL" ? styleFor(key) : null;
    return (
      <button
        key={key}
        onClick={() => setCategorie(key)}
        className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all border ${
          active
            ? "bg-gray-900 text-white border-gray-900 shadow-sm"
            : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
        }`}
      >
        {st && <span className={active ? "text-white" : ""}>{st.icon}</span>}
        {label}
        <span className={`text-[11px] rounded-full px-1.5 ${active ? "bg-white/20" : "bg-gray-100 text-gray-500"}`}>
          {n}
        </span>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50/40 via-white to-orange-50/20">
      <div className="container mx-auto py-6 sm:py-8 px-4 max-w-6xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-amber-500 to-orange-400 p-2.5 rounded-2xl shadow-sm">
              <Boxes className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Matériaux</h1>
              <p className="text-sm text-gray-500">
                {materials.length} matière{materials.length !== 1 ? "s" : ""} premières · catalogue central
              </p>
            </div>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 text-white px-4 py-2.5 text-sm font-medium shadow-sm hover:bg-gray-800 transition-colors"
          >
            <PlusCircle className="h-4 w-4" /> Nouveau matériau
          </button>
        </div>

        {/* Recherche */}
        <div className="relative mb-4">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un matériau, un format…"
            className="pl-10 h-11 rounded-xl bg-white border-gray-200 shadow-sm"
          />
        </div>

        {/* Filtres pilules */}
        <div className="flex flex-wrap gap-2 mb-6">
          {pill("ALL", "Tout", materials.length)}
          {MATERIAL_CATEGORIES.map((c) => pill(c, c, counts[c] || 0))}
        </div>

        <MaterialCatalogList
          materials={filtered}
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
          <AlertDialogContent className="bg-white rounded-2xl shadow-lg">
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
              <AlertDialogDescription>
                Êtes-vous sûr de vouloir supprimer ce matériau ? Cette action est irréversible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-white">Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700">
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
