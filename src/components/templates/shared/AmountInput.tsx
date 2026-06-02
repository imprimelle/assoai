
import React from "react";
import { Input } from "@/components/ui/input";
import type { AmountInputProps } from "@/types";
import { formatCFA } from "@/utils/format";

export const AmountInput: React.FC<AmountInputProps> = ({
  value,
  onChange,
  label,
  isEditable = false,
  min = 0,
  step = 1
}) => {
  // Formatage de l'affichage du nombre avec deux décimales
  const formattedValue = typeof value === 'number' ? value : 0;

  return (
    <div className="w-full">
      {label && (
        <label className="block text-xs font-medium text-gray-500 uppercase mb-1">
          {label}
        </label>
      )}
      {isEditable ? (
        <Input
          type="number"
          min={min}
          step={step}
          value={formattedValue}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-10 text-base w-full"
        />
      ) : (
        <div className="h-10 flex items-center text-sm text-gray-900 font-medium">
          {formatCFA(formattedValue)}
        </div>
      )}
    </div>
  );
};
