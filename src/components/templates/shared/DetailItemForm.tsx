
import React, { useState, useRef } from "react";
import { Trash2, Download, Upload, X, Image as ImageIcon, Loader2 } from "lucide-react";
import { DetailItemFormProps } from "@/types";
import { formatCFA } from "@/utils/format";
import UnifiedAtInput from "@/components/shared/UnifiedAtInput";
import type { AtSuggestion } from "@/components/shared/UnifiedAtInput";
import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from "uuid";

const DetailItemForm: React.FC<DetailItemFormProps> = ({
  id,
  description,
  quantite,
  prix,
  sousTotal,
  image_url,
  onDelete,
  onChange,
  isEditable = false,
  disableAmountEdit = false,
}) => {
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Sélection produit → MAJ prix unitaire ──
  // setTimeout évite le batching React : handleSelect a déjà mis à jour
  // la description via onChange, et onSuggestionSelect arrive dans le même tick.
  const handleProductSelect = (sugg: AtSuggestion) => {
    if ((sugg.kind === "product" || sugg.kind === "variant") && sugg.data?.price) {
      setTimeout(() => onChange({ prixUnitaire: sugg.data.price }), 0);
    }
  };

  // ── Upload ──
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploading(true);
      const fileExt = file.name.split(".").pop();
      const fileName = `${uuidv4()}.${fileExt}`;
      const filePath = `public/${fileName}`;

      const { error: uploadErr } = await supabase.storage
        .from("images")
        .upload(filePath, file);
      if (uploadErr) throw uploadErr;

      const { data } = supabase.storage.from("images").getPublicUrl(filePath);
      onChange({ image_url: data.publicUrl });
    } catch {
      console.error("Erreur upload image");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownloadImage = () => {
    if (!image_url) return;
    const a = document.createElement("a");
    a.href = image_url;
    a.download = `article_${id}.jpg`;
    a.click();
  };

  return (
    <div className="relative bg-white border border-gray-200 rounded-lg px-3 py-2 space-y-1.5">
      {/* ── Ligne 1 : Description + Supprimer (petit, à droite) ── */}
      <div className="flex items-center gap-1.5">
        <div className="flex-1 min-w-0">
          {isEditable ? (
            <UnifiedAtInput
              value={description}
              onChange={(v) => onChange({ description: v })}
              onSuggestionSelect={handleProductSelect}
              mode="product"
              placeholder="Description… @ pour chercher un produit"
              multiline
            />
          ) : (
            <div className="text-sm text-gray-900 min-h-[36px] flex items-center">
              {description || <span className="text-gray-400 text-xs">Sans description</span>}
            </div>
          )}
        </div>
        {isEditable && (
          <button
            type="button"
            onClick={onDelete}
            className="text-red-400 hover:text-red-600 hover:bg-red-50 p-0.5 rounded transition-colors shrink-0 self-start mt-0.5"
            title="Supprimer l'article"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {/* ── Ligne 2 : Qté + PU ── */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-gray-400 font-medium shrink-0">Qté</span>
          {isEditable && !disableAmountEdit ? (
            <input
              type="number"
              min={1}
              value={quantite}
              onChange={(e) => onChange({ quantite: Number(e.target.value) || 1 })}
              className="w-14 h-7 border border-gray-200 rounded-lg px-1.5 text-xs text-center"
            />
          ) : (
            <span className="text-xs font-medium w-14 text-center">{quantite}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-gray-400 font-medium shrink-0">PU</span>
          {isEditable && !disableAmountEdit ? (
            <input
              type="number"
              min={0}
              step={500}
              value={prix}
              onChange={(e) => onChange({ prixUnitaire: Number(e.target.value) || 0 })}
              className="w-24 h-7 border border-gray-200 rounded-lg px-1.5 text-xs text-right"
            />
          ) : (
            <span className="text-xs text-right w-24">{formatCFA(prix)}</span>
          )}
        </div>
      </div>

      {/* ── Ligne 3 : Miniature + Total ── */}
      <div className="flex items-center gap-2">
        {/* Miniature */}
        {image_url ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setImageModalOpen(true);
            }}
            className="shrink-0 w-10 h-10 rounded-lg overflow-hidden border-2 border-white shadow-sm
                       hover:shadow-md hover:scale-105 transition-all duration-200 cursor-pointer"
            title="Voir l'image"
          >
            <img src={image_url} alt="Article" className="w-full h-full object-cover" />
          </button>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (isEditable) fileInputRef.current?.click();
            }}
            className="shrink-0 w-10 h-10 rounded-lg bg-gray-100 border border-gray-200
                       flex items-center justify-center hover:bg-gray-200 transition-colors"
            title={isEditable ? "Ajouter une image" : "Pas d'image"}
          >
            <ImageIcon size={15} className="text-gray-400" />
          </button>
        )}

        {/* Upload caché */}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

        <div className="flex-1" />

        {/* Total */}
        <div className="text-right shrink-0">
          <span className="text-[10px] text-gray-400 font-medium block">Total</span>
          <span className="text-sm font-bold text-gray-800">{formatCFA(sousTotal)}</span>
        </div>
      </div>

      {/* ── Modal image (identique CDC Builder) ── */}
      {imageModalOpen && image_url && (
        <div
          className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4"
          onClick={() => setImageModalOpen(false)}
        >
          <div
            className="relative bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50 shrink-0">
              <span className="text-sm font-medium text-gray-700 truncate max-w-[60%]">
                {description || "Article"}
              </span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={handleDownloadImage}
                  className="p-2 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors" title="Télécharger">
                  <Download size={18} />
                </button>
                <button type="button" onClick={() => { fileInputRef.current?.click(); setImageModalOpen(false); }}
                  className="p-2 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors" title="Changer l'image">
                  <Upload size={18} />
                </button>
                <button type="button" onClick={() => { onChange({ image_url: "" }); setImageModalOpen(false); }}
                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Supprimer l'image">
                  <Trash2 size={18} />
                </button>
                <button type="button" onClick={() => setImageModalOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors ml-2" title="Fermer">
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-gray-900/5">
              <img src={image_url} alt={description || "Article"}
                className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-md" />
            </div>
          </div>
        </div>
      )}

      {isUploading && (
        <div className="absolute inset-0 bg-white/60 rounded-lg flex items-center justify-center z-10">
          <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
        </div>
      )}
    </div>
  );
};

export default DetailItemForm;
