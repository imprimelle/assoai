// src/components/configurator/controls/MaterialPreview.tsx
// Tableau temps réel — quantités calculées et coûts par matériau.

import React, { useMemo } from "react";
import type { BomCalculation } from "../BOMCalculator";

// Couleurs par section (identiques à BomEditor)
const SECTION_DOT: Record<string, string> = {
  Découpe: "bg-rose-400",
  Éclairage: "bg-amber-400",
  Outillage: "bg-emerald-400",
  Métal: "bg-slate-400",
  Vinyl: "bg-purple-400",
};

interface MaterialPreviewProps {
  calculations: BomCalculation[];
  totalCost: number | null;
}

const MaterialPreview: React.FC<MaterialPreviewProps> = ({
  calculations,
  totalCost,
}) => {
  // Grouper par section
  const bySection = useMemo(() => {
    const map = new Map<string, BomCalculation[]>();
    for (const calc of calculations) {
      const items = map.get(calc.section) || [];
      items.push(calc);
      map.set(calc.section, items);
    }
    return map;
  }, [calculations]);

  if (calculations.length === 0) return null;

  const formatCFA = (val: number | null): string => {
    if (val == null) return "—";
    return new Intl.NumberFormat("fr-FR", {
      style: "decimal",
      maximumFractionDigits: 0,
    }).format(Math.round(val)) + " F";
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Matériaux estimés
        </h4>
        {totalCost != null && (
          <span className="text-sm font-bold text-brand-orange tabular-nums">
            {formatCFA(totalCost)} CFA
          </span>
        )}
      </div>

      {Array.from(bySection.entries()).map(([section, items]) => (
        <div key={section} className="space-y-0">
          {/* En-tête section */}
          <div className="flex items-center gap-2 px-2 py-1 rounded-t bg-white/5">
            <span
              className={`w-2 h-2 rounded-full ${SECTION_DOT[section] || "bg-gray-400"}`}
            />
            <span className="text-[10px] font-semibold text-gray-400">
              {section}
            </span>
          </div>

          {/* Items */}
          <div className="divide-y divide-white/5">
            {items.map((item, i) => (
              <div
                key={`${item.section}-${i}`}
                className="flex items-center justify-between px-2 py-1.5 text-xs"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-gray-300 truncate block">
                    {item.material_id ? "✅ " : "📝 "}
                    {item.material_name}
                  </span>
                  {item.formule && (
                    <span className="text-[9px] text-gray-600 font-mono">
                      {item.formule}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-2">
                  <span className="font-mono text-white tabular-nums text-xs">
                    {item.quantite_calculee.toFixed(2)}
                    <span className="text-gray-500 ml-0.5">{item.unite}</span>
                  </span>
                  <span className="text-gray-500 tabular-nums w-16 text-right text-[11px]">
                    {formatCFA(item.cout_total)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Total */}
      {totalCost != null && (
        <div className="flex justify-between items-center px-2 py-2 border-t border-white/10 pt-2">
          <span className="text-xs font-semibold text-gray-300">Total estimé</span>
          <span className="text-sm font-bold text-brand-orange tabular-nums">
            {formatCFA(totalCost)} CFA
          </span>
        </div>
      )}
    </div>
  );
};

export default MaterialPreview;
