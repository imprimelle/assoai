// src/components/configurator/ConfigurateurFooter.tsx
// Footer sticky unifié — pattern InfinityMirror, piloté par la BOM.
// Mini-stats + tabs contextuels (Dimensions, Matériaux) + actions (Reset, CDC).

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Ruler,
  Zap,
  Package,
  FileSpreadsheet,
  RotateCcw,
  ChevronUp,
  ChevronDown,
  Maximize2,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import DynamicControls from "./controls/DynamicControls";
import MaterialPreview from "./controls/MaterialPreview";
import type { BomVariable, BomCalculation } from "./BOMCalculator";

// ============================================================
// TYPES
// ============================================================

type FooterTab = "dimensions" | "materiaux";

interface ConfigurateurFooterProps {
  /** Variables BOM (pour les sliders). */
  variables: BomVariable[];
  /** Valeurs actuelles des variables. */
  variableValues: Record<string, number>;
  /** Callback quand une variable change. */
  onVariableChange: (symbol: string, value: number) => void;
  /** Calculs BOM (quantités, coûts). */
  calculations: BomCalculation[];
  /** Coût total estimé. */
  totalCost: number | null;
  /** La BOM a-t-elle des items ? */
  hasBom: boolean;
  /** Nom du produit sélectionné. */
  productName?: string;
  /** Callback pour générer le CDC. */
  onGenerateCDC: () => void;
  /** Callback pour reset. */
  onReset: () => void;
}

// ============================================================
// CONSTANTES
// ============================================================

const TABS: { key: FooterTab; icon: React.ReactNode; label: string }[] = [
  { key: "dimensions", icon: <Ruler className="h-3.5 w-3.5" />, label: "Dimensions" },
  { key: "materiaux", icon: <Wrench className="h-3.5 w-3.5" />, label: "Matériaux" },
];

// ============================================================
// COMPOSANT
// ============================================================

const ConfigurateurFooter: React.FC<ConfigurateurFooterProps> = ({
  variables,
  variableValues,
  onVariableChange,
  calculations,
  totalCost,
  hasBom,
  productName,
  onGenerateCDC,
  onReset,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<FooterTab>("dimensions");
  const footerRef = useRef<HTMLDivElement>(null);
  const [footerHeight, setFooterHeight] = useState(56);

  // Calculer les mini-stats depuis la BOM
  const L = variableValues.L ?? 1;
  const H = variableValues.H ?? 1;
  const surface = L * H;
  const perimeter = 2 * (L + H);

  // LED count from BOM calculations (Éclairage section)
  const ledItems = calculations.filter((c) => c.section === "Éclairage");
  const ledTotal = ledItems.reduce((sum, c) => sum + c.quantite_calculee, 0);

  useEffect(() => {
    if (footerRef.current) setFooterHeight(footerRef.current.offsetHeight || 56);
  }, [expanded, activeTab]);

  return createPortal(
    <div
      ref={footerRef}
      className="fixed bottom-0 left-0 right-0 bg-[#0f0f1a]/95 backdrop-blur-md border-t border-white/10 shadow-lg z-50"
    >
      {/* === BARRE MINI-STATS === */}
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="flex-1 flex items-center gap-3 text-xs overflow-x-auto">
          {productName && (
            <span className="text-gray-400 font-medium truncate max-w-[150px]">
              {productName}
            </span>
          )}
          <MiniStat
            icon={<Maximize2 className="h-3 w-3 text-brand-orange" />}
            value={`${surface.toFixed(2)} m²`}
          />
          <MiniStat
            icon={<Ruler className="h-3 w-3 text-blue-400" />}
            value={`${perimeter.toFixed(2)} m`}
          />
          {ledTotal > 0 && (
            <MiniStat
              icon={<Zap className="h-3 w-3 text-yellow-400" />}
              value={`${ledTotal.toFixed(0)} LED`}
            />
          )}
          {hasBom && (
            <MiniStat
              icon={<Package className="h-3 w-3 text-green-400" />}
              value={`${calculations.length} mat.`}
            />
          )}
          {totalCost != null && (
            <MiniStat
              icon={<Wrench className="h-3 w-3 text-purple-400" />}
              value={`${Math.round(totalCost).toLocaleString("fr-FR")} F`}
            />
          )}
        </div>

        <button
          onClick={onReset}
          className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5"
          title="Réinitialiser"
        >
          <RotateCcw className="h-4 w-4" />
        </button>

        <button
          onClick={onGenerateCDC}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-orange hover:bg-orange-600 text-white text-xs font-semibold transition-all shadow-lg shadow-brand-orange/20"
        >
          <FileSpreadsheet className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Générer un CDC</span>
        </button>

        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5"
        >
          {expanded ? (
            <ChevronDown className="h-5 w-5" />
          ) : (
            <ChevronUp className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* === PANNEAU EXPANSIBLE === */}
      {expanded && (
        <div className="px-3 pb-3 space-y-3 max-h-[50vh] overflow-y-auto">
          {/* Tabs */}
          <div className="flex gap-1 bg-white/5 rounded-lg p-0.5">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-all ${
                  activeTab === tab.key
                    ? "bg-brand-orange text-white shadow-sm"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Contenu des tabs */}
          {activeTab === "dimensions" && variables.length > 0 && (
            <div className="space-y-3">
              <DynamicControls
                variables={variables}
                values={variableValues}
                onChange={onVariableChange}
              />

              {/* Mini preview ratio L×H */}
              <div className="bg-white/5 rounded-lg p-3 flex items-center gap-4">
                <div
                  className="relative border border-white/20 rounded"
                  style={{
                    width: 60,
                    height: Math.max(30, 60 * (H / L)),
                  }}
                >
                  <div className="absolute inset-1 border border-brand-orange/40 rounded-sm flex items-center justify-center">
                    <span className="text-[9px] text-brand-orange font-mono">
                      {L.toFixed(0)}×{H.toFixed(0)}
                    </span>
                  </div>
                </div>
                <div className="flex-1 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Surface</span>
                    <span className="font-mono text-white">{surface.toFixed(2)} m²</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Périmètre</span>
                    <span className="font-mono text-white">{perimeter.toFixed(2)} m</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Ratio</span>
                    <span className="font-mono text-white">{(L / H).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "materiaux" && (
            <div className="space-y-3">
              {hasBom ? (
                <MaterialPreview calculations={calculations} totalCost={totalCost} />
              ) : (
                <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 text-center">
                  ⚠️ Ce produit n'a pas encore de nomenclature structurée.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>,
    document.body
  );
};

// ============================================================
// SOUS-COMPOSANTS
// ============================================================

const MiniStat: React.FC<{ icon: React.ReactNode; value: string }> = ({
  icon,
  value,
}) => (
  <div className="flex items-center gap-1 whitespace-nowrap">
    {icon}
    <span className="font-mono font-semibold text-white">{value}</span>
  </div>
);

export default ConfigurateurFooter;
