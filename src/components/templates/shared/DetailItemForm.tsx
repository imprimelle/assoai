
import React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import ImageUpload from "./ImageUpload";
import { AmountInput } from "./AmountInput";
import { Trash2 } from "lucide-react";
import { DetailItemFormProps } from "@/types";
import { formatCFA } from "@/utils/format";

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
  disableAmountEdit = false
}) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
      {/* Description */}
      <div className="w-full">
        <Label
          htmlFor={`description-${id}`}
          className="text-xs font-medium text-gray-500 uppercase mb-1"
        >
          Description
        </Label>
        {isEditable ? (
          <Textarea
            id={`description-${id}`}
            value={description}
            onChange={(e) => onChange({ description: e.target.value })}
            className="min-h-[48px] text-base w-full resize-none"
            placeholder="Description du produit ou service"
          />
        ) : (
          <div className="text-sm text-gray-900 whitespace-pre-line break-words">
            {description}
          </div>
        )}
      </div>

      {/* Qté & Montant + Total + Supprimer */}
      <div className="flex justify-between items-center space-x-4">
        {/* Qté + Prix unitaire */}
        <div className="flex items-center space-x-4">
          {(!isEditable || disableAmountEdit) ? (
            <div className="flex flex-col text-sm">
              <span className="font-medium">Qté</span>
              <span>{quantite}</span>
            </div>
          ) : (
            <AmountInput
              value={quantite}
              onChange={v => onChange({ quantite: v })}
              isEditable
              min={1}
            />
          )}

          {(!isEditable || disableAmountEdit) ? (
            <div className="flex flex-col text-sm">
              <span className="font-medium">Montant</span>
              <span>{formatCFA(prix)}</span>
            </div>
          ) : (
            <AmountInput
              value={prix}
              onChange={v => onChange({ prixUnitaire: v })}
              isEditable
              min={0}
              step={0.01}
            />
          )}
        </div>

        {/* Total de la ligne */}
        <div className="flex flex-col text-sm text-right">
          <span className="font-medium">Total</span>
          <span className="font-bold">{formatCFA(sousTotal)}</span>
        </div>

        {/* Bouton supprimer */}
        {isEditable && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="text-red-600 hover:text-red-800 p-0 h-10 w-10"
          >
            <Trash2 size={16} />
          </Button>
        )}
      </div>

      {/* Image upload — toujours visible en mode édition, même sans image */}
      {(isEditable || image_url) && (
        <div className="mt-2">
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
