// src/components/cdc-builder/EnseigneDialog.tsx
// Dialogue modal pour créer ou modifier une enseigne :
// nom, image (upload Supabase Storage), dimensions L/H/P, technique.

import React, { useState, useEffect } from "react";
import { X, Upload, Image as ImageIcon } from "lucide-react";
import ImageUpload from "@/components/templates/shared/ImageUpload";
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

  // Synchroniser le formulaire si l'enseigne change
  useEffect(() => {
    if (open) {
      setForm(enseigne || createEmptyEnseigne());
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

  const handleTechChange = (field: string, value: string) => {
    handleChange("technique", { ...form.technique, [field]: value });
  };

  const handleSave = () => {
    // Validation
    if (!form.nom.trim()) return;
    if (form.dimensions.largeur <= 0 || form.dimensions.hauteur <= 0) return;
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

            {/* Technique */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                🔧 Technique
              </label>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">
                    Type de structure
                  </label>
                  <input
                    type="text"
                    value={form.technique.type_structure}
                    onChange={(e) =>
                      handleTechChange("type_structure", e.target.value)
                    }
                    placeholder="Ex: Cadre aluminium"
                    className="h-9 w-full border border-gray-200 rounded px-3 bg-white
                               focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">
                    Méthode de fabrication
                  </label>
                  <input
                    type="text"
                    value={form.technique.method_fabrication}
                    onChange={(e) =>
                      handleTechChange("method_fabrication", e.target.value)
                    }
                    placeholder="Ex: Découpe CNC + assemblage"
                    className="h-9 w-full border border-gray-200 rounded px-3 bg-white
                               focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                  />
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
              disabled={!form.nom.trim() || form.dimensions.largeur <= 0 || form.dimensions.hauteur <= 0}
              className="px-5 py-2 text-sm font-medium text-white bg-indigo-600
                         rounded-lg hover:bg-indigo-700 transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed"
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
