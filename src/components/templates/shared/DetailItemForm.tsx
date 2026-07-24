
import React from "react";
import { Button } from "@/components/ui/button";
import ImageUpload from "./ImageUpload";
import { Trash2 } from "lucide-react";
import { DetailItemFormProps } from "@/types";
import { formatCFA } from "@/utils/format";
import UnifiedAtInput from "@/components/shared/UnifiedAtInput";

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
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 space-y-2">
      {/* Ligne 1 : Description unifiée avec @ produit */}
      {isEditable ? (
        <UnifiedAtInput
          value={description}
          onChange={(v) => onChange({ description: v })}
          mode="product"
          placeholder="Description… @ pour chercher un produit"
        />
      ) : (
        <div className="text-sm text-gray-900 whitespace-pre-line break-words min-h-[36px] flex items-center">
          {description || <span className="text-gray-400 text-xs">Sans description</span>}
        </div>
      )}

      {/* Ligne 2 : Qté | Prix U. | Total | Supprimer */}
      <div className="flex items-center gap-2">
        {/* Qté */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-gray-400 font-medium shrink-0">Qté</span>
          {isEditable && !disableAmountEdit ? (
            <input
              type="number"
              min={1}
              value={quantite}
              onChange={(e) => onChange({ quantite: Number(e.target.value) || 1 })}
              className="w-16 h-8 border border-gray-200 rounded-lg px-2 text-sm text-center"
            />
          ) : (
            <span className="text-sm font-medium w-16 text-center">{quantite}</span>
          )}
        </div>

        {/* Prix unitaire */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-gray-400 font-medium shrink-0">PU</span>
          {isEditable && !disableAmountEdit ? (
            <input
              type="number"
              min={0}
              step={500}
              value={prix}
              onChange={(e) => onChange({ prixUnitaire: Number(e.target.value) || 0 })}
              className="w-24 h-8 border border-gray-200 rounded-lg px-2 text-sm text-right"
            />
          ) : (
            <span className="text-sm text-right w-24">{formatCFA(prix)}</span>
          )}
        </div>

        {/* Total */}
        <div className="flex-1 flex items-center justify-end gap-1">
          <span className="text-[10px] text-gray-400 font-medium">Total</span>
          <span className="text-sm font-bold">{formatCFA(sousTotal)}</span>
        </div>

        {/* Supprimer */}
        {isEditable && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1 h-8 w-8 shrink-0"
          >
            <Trash2 size={14} />
          </Button>
        )}
      </div>

      {/* Image upload */}
      {(isEditable || image_url) && (
        <div>
          <ImageUpload
            imageUrl={image_url || ""}
            onChange={(url) => onChange({ image_url: url })}
            isEditable={isEditable}
          />
        </div>
      )}
    </div>
  );
};

export default DetailItemForm;
