// src/components/cdc-builder/EnseigneDialog.tsx
// Dialogue modal pour créer ou modifier une enseigne :
// nom, image (upload), recherche produit catalogue, dimensions L/H/P, technique.

import React, { useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import ImageUpload from "@/components/templates/shared/ImageUpload";
import ProductSuggestions from "@/components/shared/ProductSuggestions";
import { createEmptyEnseigne } from "@/types/cdcBuilder";
import type { CdcBuilderEnseigne } from "@/types/cdcBuilder";

export interface EnseigneDialogProps {
  open: boolean;
  enseigne?: CdcBuilderEnseigne;
  onSave: (enseigne: CdcBuilderEnseigne) => void;
  onClose: () => void;
}

const EnseigneDialog: React.FC<EnseigneDialogProps> = ({
  open,
  enseigne,
  onSave,
  onClose,
}) => {
  const isEditing = !!enseigne;
  const [form, setForm] = useState<CdcBuilderEnseigne>(
    enseigne || createEmptyEnseigne(),
  );
  const [error, setError] = useState<string | null>(null);

  // Synchroniser le formulaire si l'enseigne change
  useEffect(() => {
    if (open) {
      setForm(enseigne || createEmptyEnseigne());
      setError(null);
    }
  }, [open, enseigne]);

  const handleChange = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleDimChange = (field: string, raw: string) => {
    const num = raw === "" ? 0 : Number(raw);
    if (Number.isNaN(num)) return;
    handleChange("dimensions", {
      ...form.dimensions,
      [field]: Math.max(0, num),
    });
  };

  // Sélection d'un produit depuis le catalogue
  const handleProductSelect = useCallback(
    (product: { description: string; prixUnitaire: number; image_url?: string | null }) => {
      setForm((prev) => ({
        ...prev,
        nom: product.description || prev.nom,
        image_url: product.image_url || prev.image_url,
      }));
    },
    [],
  );

  const handleSave = () => {
    if (!form.nom.trim()) {
      setError("Veuillez entrer un nom pour l'enseigne.");
      return;
    }
    if (form.dimensions.largeur <= 0 || form.dimensions.hauteur <= 0) {
      setError("Veuillez renseigner les dimensions (largeur et hauteur) avant de sauvegarder.");
      return;
    }
    onSave(form);
  };

  if (!open) return null;

  const cellInput =
    "h-9 border border-gray-200 rounded px-2 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none";

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Modal */}
        <div
          className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">
              {isEditing ? `✏️ Éditer ${enseigne!.nom}` : "📝 Nouvelle enseigne"}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-4 space-y-5">
            {/* Bandeau d'erreur */}
            {error && (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {/* Recherche produit catalogue */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                🔍 Rechercher dans le catalogue produits
              </label>
              <ProductSuggestions
                onSelectProduct={handleProductSelect}
                placeholder="Chercher une enseigne/produit…"
              />
              <p className="text-xs text-gray-400 mt-1">
                Sélectionnez un produit pour pré-remplir le nom et l'image
              </p>
            </div>

            {/* Nom */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom
              </label>
              <input
                type="text"
                value={form.nom}
                onChange={(e) => handleChange("nom", e.target.value)}
                placeholder="Ex: Façade principale"
                className="h-9 w-full border border-gray-200 rounded px-3 bg-white
                           focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
              />
            </div>

            {/* Image */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                🖼️ Image
              </label>
              <ImageUpload
                imageUrl={form.image_url}
                onChange={(url) => handleChange("image_url", url)}
                isEditable
                label=""
                placeholder="Uploader une image de l'enseigne"
              />
            </div>

            {/* Dimensions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📏 Dimensions
              </label>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-500">L</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={1}
                    value={form.dimensions.largeur || ""}
                    onChange={(e) => handleDimChange("largeur", e.target.value)}
                    className={`${cellInput} w-20 text-center`}
                  />
                  <span className="text-xs text-gray-400">cm</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-500">H</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={1}
                    value={form.dimensions.hauteur || ""}
                    onChange={(e) => handleDimChange("hauteur", e.target.value)}
                    className={`${cellInput} w-20 text-center`}
                  />
                  <span className="text-xs text-gray-400">cm</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-500">P</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={form.dimensions.profondeur || ""}
                    onChange={(e) =>
                      handleDimChange("profondeur", e.target.value)
                    }
                    className={`${cellInput} w-20 text-center`}
                  />
                  <span className="text-xs text-gray-400">cm</span>
                </div>
              </div>
            </div>

          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-xl">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600
                         hover:text-gray-800 transition-colors"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 text-sm font-medium text-white bg-indigo-600
                         rounded-lg hover:bg-indigo-700 transition-colors"
            >
              💾 Sauvegarder
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default EnseigneDialog;
