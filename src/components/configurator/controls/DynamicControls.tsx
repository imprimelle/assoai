// src/components/configurator/controls/DynamicControls.tsx
// Sliders générés dynamiquement à partir des variables extraites de la BOM.

import React from "react";
import { Slider } from "@/components/ui/slider";
import type { BomVariable } from "../BOMCalculator";

interface DynamicControlsProps {
  variables: BomVariable[];
  values: Record<string, number>;
  onChange: (symbol: string, value: number) => void;
}

/**
 * Affiche un slider par variable BOM.
 * - L et H : dimensions principales (toujours présentes)
 * - P : profondeur (si présente dans les formules)
 * - d : diamètre (si présent dans les formules)
 */
const DynamicControls: React.FC<DynamicControlsProps> = ({
  variables,
  values,
  onChange,
}) => {
  if (variables.length === 0) return null;

  return (
    <div className="space-y-4">
      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
        Dimensions
      </h4>
      <div className="space-y-3">
        {variables.map((v) => {
          const current = values[v.symbol] ?? v.value;
          return (
            <div key={v.symbol} className="space-y-1.5">
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-gray-400">{v.label}</span>
                <span className="text-sm font-mono font-semibold text-white tabular-nums">
                  {v.symbol === "L" || v.symbol === "H" || v.symbol === "P"
                    ? (current * 100).toFixed(0)
                    : current.toFixed(2)}
                  <span className="text-gray-500 ml-0.5 text-xs">
                    {v.symbol === "L" || v.symbol === "H" || v.symbol === "P"
                      ? "cm"
                      : v.unit}
                  </span>
                </span>
              </div>
              <Slider
                value={[current]}
                min={v.min}
                max={v.max}
                step={v.step}
                onValueChange={([val]) => onChange(v.symbol, val)}
              />
              {/* Min/Max labels */}
              <div className="flex justify-between text-[9px] text-gray-600">
                <span>
                  {v.symbol === "L" || v.symbol === "H" || v.symbol === "P"
                    ? (v.min * 100).toFixed(0)
                    : v.min.toFixed(2)}
                </span>
                <span>
                  {v.symbol === "L" || v.symbol === "H" || v.symbol === "P"
                    ? (v.max * 100).toFixed(0)
                    : v.max.toFixed(2)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DynamicControls;
