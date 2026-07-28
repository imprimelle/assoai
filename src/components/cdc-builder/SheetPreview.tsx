// src/components/cdc-builder/SheetPreview.tsx
// Aperçu visuel SVG du placement des plaques sur une ou plusieurs feuilles.
// Remplace le toggle "Déplier" — affiche les plaques disposées spatialement.

import React, { useState, useMemo } from "react";
import { X, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import type { FeuillePlacement, Placement2D, Chute2D } from "@/types/cdcBuilder";

const SCALE = 100; // pixels par mètre (1m = 100px dans le SVG)

const PLAQUE_COLORS = [
  "#818cf8", "#34d399", "#fbbf24", "#f472b6",
  "#38bdf8", "#a78bfa", "#fb923c", "#4ade80",
];

/** Assombrit une couleur hex pour le contour */
function darken(hex: string, amount: number): string {
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - Math.round(255 * amount));
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - Math.round(255 * amount));
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - Math.round(255 * amount));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/** Formate un nombre en mètres avec 2 décimales */
function fmtM(v: number): string {
  return v.toFixed(2) + "m";
}

export interface SheetPreviewProps {
  feuilleL: number;
  feuilleH: number;
  feuilles: FeuillePlacement[];
  nomMateriau: string;
  onClose: () => void;
  onRecalculer?: () => void;
  /** Si true, pas de placement calculé (groupe legacy) */
  hasPlacements?: boolean;
}

const SheetPreview: React.FC<SheetPreviewProps> = ({
  feuilleL,
  feuilleH,
  feuilles,
  nomMateriau,
  onClose,
  onRecalculer,
  hasPlacements = true,
}) => {
  const [activeSheet, setActiveSheet] = useState(0);
  const current = feuilles[activeSheet];

  // Assigner des couleurs stables aux plaques par leur nom
  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    let idx = 0;
    for (const sheet of feuilles) {
      for (const p of sheet.placements) {
        if (!map.has(p.nom)) {
          map.set(p.nom, PLAQUE_COLORS[idx % PLAQUE_COLORS.length]);
          idx++;
        }
      }
    }
    return map;
  }, [feuilles]);

  // Stats pour cette feuille
  const sheetSurface = feuilleL * feuilleH;
  const usedSurface = current
    ? current.placements.reduce((s, p) => s + p.largeur * p.hauteur, 0)
    : 0;
  const chuteSurface = Math.max(0, sheetSurface - usedSurface);
  const ratio = sheetSurface > 0 ? usedSurface / sheetSurface : 0;

  // Stats globales
  const totalSurface = feuilles.length * sheetSurface;
  const totalUsed = feuilles.reduce(
    (s, f) => s + f.placements.reduce((ss, p) => ss + p.largeur * p.hauteur, 0),
    0,
  );
  const totalChute = Math.max(0, totalSurface - totalUsed);
  const totalRatio = totalSurface > 0 ? totalUsed / totalSurface : 0;

  const svgW = feuilleL * SCALE;
  const svgH = feuilleH * SCALE;

  const renderSheet = (sheet: FeuillePlacement) => (
    <svg
      viewBox={`0 0 ${svgW} ${svgH}`}
      className="w-full border border-gray-300 rounded-lg bg-white"
      style={{ maxHeight: "55vh" }}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Grille fine */}
      <defs>
        <pattern
          id={`grid-${sheet.feuille_index}`}
          width={0.1 * SCALE}
          height={0.1 * SCALE}
          patternUnits="userSpaceOnUse"
        >
          <path
            d={`M ${0.1 * SCALE} 0 L 0 0 0 ${0.1 * SCALE}`}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth={0.5}
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />

      {/* Contour feuille */}
      <rect
        width={svgW}
        height={svgH}
        fill="none"
        stroke="#94a3b8"
        strokeWidth={2}
      />

      {/* Plaques */}
      {sheet.placements.map((p, i) => {
        const color = colorMap.get(p.nom) || PLAQUE_COLORS[0];
        return (
          <g
            key={p.enfant_id || i}
            transform={`translate(${p.x * SCALE}, ${p.y * SCALE})`}
          >
            <rect
              width={p.largeur * SCALE}
              height={p.hauteur * SCALE}
              fill={color}
              fillOpacity={0.85}
              stroke={darken(color, 0.15)}
              strokeWidth={1.5}
              rx={3}
            />
            {p.rotated && (
              <text x={5} y={16} fontSize={12} fill="white" fontWeight="bold">
                ↻
              </text>
            )}
            {/* Nom de la plaque */}
            <text
              x={(p.largeur * SCALE) / 2}
              y={(p.hauteur * SCALE) / 2 - 5}
              textAnchor="middle"
              fontSize={13}
              fill="white"
              fontWeight={600}
              fontFamily="system-ui, sans-serif"
            >
              {p.nom}
            </text>
            {/* Dimensions */}
            <text
              x={(p.largeur * SCALE) / 2}
              y={(p.hauteur * SCALE) / 2 + 12}
              textAnchor="middle"
              fontSize={10}
              fill="white"
              fillOpacity={0.85}
              fontFamily="system-ui, sans-serif"
            >
              {fmtM(p.largeur)} × {fmtM(p.hauteur)}
            </text>
          </g>
        );
      })}

      {/* Chutes */}
      {sheet.chutes.map((c, i) => (
        <rect
          key={`chute-${i}`}
          x={c.x * SCALE}
          y={c.y * SCALE}
          width={c.largeur * SCALE}
          height={c.hauteur * SCALE}
          fill="#f1f5f9"
          stroke="#cbd5e1"
          strokeWidth={1}
          strokeDasharray="6 4"
          rx={2}
        />
      ))}
    </svg>
  );

  // Rendu "pas de placements" (legacy)
  const renderNoPlacements = () => (
    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
      <div className="text-4xl mb-3">📐</div>
      <p className="text-sm font-medium">Placement non calculé</p>
      <p className="text-xs mt-1">
        Ce groupe a été créé avant la fonction d'aperçu.
      </p>
      {onRecalculer && (
        <button
          type="button"
          onClick={onRecalculer}
          className="mt-4 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                     text-indigo-600 bg-indigo-50 hover:bg-indigo-100
                     rounded-lg transition-colors"
        >
          <RotateCcw size={12} />
          Calculer le placement
        </button>
      )}
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200"
        style={{ maxHeight: "90vh", display: "flex", flexDirection: "column" }}
      >
        {/* En-tête */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              Aperçu — {nomMateriau}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {fmtM(feuilleL)} × {fmtM(feuilleH)}
              {feuilles.length > 1 && (
                <span className="ml-2 text-amber-600 font-medium">
                  · {feuilles.length} feuilles nécessaires
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs multi-feuille */}
        {hasPlacements && feuilles.length > 1 && (
          <div className="flex items-center gap-1 px-5 py-2 bg-gray-50 border-b border-gray-100 shrink-0 overflow-x-auto">
            {feuilles.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveSheet(i)}
                className={`shrink-0 px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                  i === activeSheet
                    ? "bg-indigo-500 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                }`}
              >
                Feuille {i + 1}
              </button>
            ))}
          </div>
        )}

        {/* Contenu SVG */}
        <div className="flex-1 overflow-auto p-4">
          {hasPlacements && current
            ? renderSheet(current)
            : renderNoPlacements()}
        </div>

        {/* Stats footer */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 shrink-0">
          {hasPlacements ? (
            <div className="space-y-1.5">
              {feuilles.length > 1 ? (
                <>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Surface totale</span>
                    <span className="font-medium">
                      {fmtM(totalSurface)} = {fmtM(sheetSurface)} × {feuilles.length}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Surface utilisée</span>
                    <span className="font-medium">
                      {fmtM(totalUsed)} ({(totalRatio * 100).toFixed(0)}%)
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Chute totale</span>
                    <span className="font-medium">
                      {fmtM(totalChute)} ({((1 - totalRatio) * 100).toFixed(0)}%)
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Surface utilisée</span>
                    <span className="font-medium">
                      {fmtM(usedSurface)} / {fmtM(sheetSurface)} ({(ratio * 100).toFixed(0)}%)
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Chute</span>
                    <span className="font-medium">
                      {fmtM(chuteSurface)} ({((1 - ratio) * 100).toFixed(0)}%)
                    </span>
                  </div>
                </>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-400 text-center">
              Utilisez "Calculer le placement" pour générer l'aperçu.
            </p>
          )}

          {/* Bouton recalculer */}
          {onRecalculer && hasPlacements && (
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={onRecalculer}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                           text-indigo-600 bg-white hover:bg-indigo-50
                           border border-indigo-200 rounded-lg transition-colors"
              >
                <RotateCcw size={12} />
                Recalculer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SheetPreview;
