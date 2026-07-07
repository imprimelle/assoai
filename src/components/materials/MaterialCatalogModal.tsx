// src/components/materials/MaterialCatalogModal.tsx
import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import MaterialCatalogForm from "./MaterialCatalogForm";
import { styleFor } from "./materialFields";
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
        puissance_volt: m.puissance_volt ?? null,
        etancheite: m.etancheite ?? null,
        indications: m.indications ?? null,
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
  const style = styleFor(data.categorie);
  const title =
    mode === "create" ? "Nouveau matériau" : mode === "edit" ? "Modifier le matériau" : data.materiau || "Matériau";

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
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden bg-white rounded-2xl [&>button]:hidden">
        {/* En-tête thématisé */}
        <div className={`relative bg-gradient-to-r ${style.gradient} px-6 py-5`}>
          <div className="flex items-center gap-3 text-white">
            <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
              {style.icon}
            </div>
            <div>
              <h2 className="text-lg font-bold leading-tight">{title}</h2>
              <p className="text-xs text-white/80">{data.categorie}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Corps */}
        <div className="px-6 py-5 max-h-[65vh] overflow-y-auto">
          <MaterialCatalogForm data={data} onChange={setData} readOnly={readOnly} />
        </div>

        {/* Footer collant */}
        {!readOnly && (
          <div className="border-t bg-white px-6 py-3 flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Annuler
            </Button>
            <Button onClick={handleSubmit} disabled={saving || !data.materiau.trim()}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MaterialCatalogModal;
