// src/components/materials/MaterialCatalogModal.tsx
import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import MaterialCatalogForm from "./MaterialCatalogForm";
import {
  MaterialCatalogEntry,
  MaterialCatalogFormData,
  EMPTY_MATERIAL,
} from "@/types/materialCatalog";

export type MaterialModalMode = "create" | "edit" | "view";

interface Props {
  isOpen: boolean;
  mode: MaterialModalMode;
  material?: MaterialCatalogEntry | null;
  onClose: () => void;
  onSubmit: (data: MaterialCatalogFormData) => Promise<void> | void;
}

const toFormData = (m?: MaterialCatalogEntry | null): MaterialCatalogFormData =>
  m
    ? {
        external_id: m.external_id,
        categorie: m.categorie,
        materiau: m.materiau,
        epaisseur: m.epaisseur,
        format_standard: m.format_standard,
        largeur_std: m.largeur_std,
        hauteur_std: m.hauteur_std,
        cout_min: m.cout_min,
        cout_max: m.cout_max,
        cout_usinage: m.cout_usinage,
        unite: m.unite,
        couleurs: m.couleurs,
        image_url: m.image_url,
      }
    : { ...EMPTY_MATERIAL };

const MaterialCatalogModal: React.FC<Props> = ({
  isOpen,
  mode,
  material,
  onClose,
  onSubmit,
}) => {
  const [data, setData] = useState<MaterialCatalogFormData>(toFormData(material));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) setData(toFormData(material));
  }, [isOpen, material]);

  const readOnly = mode === "view";
  const title =
    mode === "create"
      ? "Nouveau matériau"
      : mode === "edit"
        ? "Modifier le matériau"
        : data.materiau;

  const handleSubmit = async () => {
    if (!data.materiau.trim()) return;
    setSaving(true);
    try {
      await onSubmit(data);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <MaterialCatalogForm data={data} onChange={setData} readOnly={readOnly} />

        {!readOnly && (
          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Annuler
            </Button>
            <Button onClick={handleSubmit} disabled={saving || !data.materiau.trim()}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MaterialCatalogModal;
