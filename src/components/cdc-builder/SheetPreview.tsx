// src/components/cdc-builder/SheetPreview.tsx
// Aperçu visuel SVG du placement des plaques sur une ou plusieurs feuilles.
// v2 : cotations extérieures, lettres (A,B,C...), légende, sans grille.

import React, { useState, useMemo } from "react";
import { X, RotateCcw } from "lucide-react";
import type { FeuillePlacement } from "@/types/cdcBuilder";

const SCALE = 100;       // pixels par mètre (1m = 100px dans le SVG)
const MARGIN = 50;       // marge pour les cotations (px)
const ARROW = 8;         // taille des flèches de cotation (px)

const PLAQUE_COLORS = [
  "#6366f1", "#10b981", "#f59e0b", "#ec4899",
  "#0ea5e9", "#8b5cf6", "#f97316", "#22c55e",
  "#ef4444", "#14b8a6", "#a855f7", "#eab308",
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
  return v.toFixed(2).replace(/\.?0+$/, "") + "m";
}

/** Convertit un index en lettre : 0→A, 1→B, ..., 25→Z, 26→AA, etc. */
function indexToLetter(i: number): string {
  let n = i;
  let result = "";
  do {
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return result;
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

  const svgW = feuilleL * SCALE + MARGIN * 2;
  const svgH = feuilleH * SCALE + MARGIN * 2;

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

  // ── Rendu SVG d'une feuille ──

  const renderSheet = (sheet: FeuillePlacement) => {
    const fw = feuilleL * SCALE;
    const fh = feuilleH * SCALE;

    return (
      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="w-full bg-white rounded-lg"
        style={{ maxHeight: "60vh" }}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Fond de la feuille */}
        <rect
          x={MARGIN}
          y={MARGIN}
          width={fw}
          height={fh}
          fill="#fafbfc"
          stroke="#475569"
          strokeWidth={2.5}
          rx={2}
        />

        {/* ── Cotations extérieures ── */}

        {/* Cotation horizontale (haut) */}
        <line
          x1={MARGIN}
          y1={MARGIN - 18}
          x2={MARGIN + fw}
          y2={MARGIN - 18}
          stroke="#64748b"
          strokeWidth={1}
        />
        {/* Flèche gauche */}
        <line x1={MARGIN} y1={MARGIN - 18} x2={MARGIN + ARROW} y2={MARGIN - 18 - ARROW / 2} stroke="#64748b" strokeWidth={1.2} />
        <line x1={MARGIN} y1={MARGIN - 18} x2={MARGIN + ARROW} y2={MARGIN - 18 + ARROW / 2} stroke="#64748b" strokeWidth={1.2} />
        {/* Flèche droite */}
        <line x1={MARGIN + fw} y1={MARGIN - 18} x2={MARGIN + fw - ARROW} y2={MARGIN - 18 - ARROW / 2} stroke="#64748b" strokeWidth={1.2} />
        <line x1={MARGIN + fw} y1={MARGIN - 18} x2={MARGIN + fw - ARROW} y2={MARGIN - 18 + ARROW / 2} stroke="#64748b" strokeWidth={1.2} />
        {/* Texte L */}
        <text
          x={MARGIN + fw / 2}
          y={MARGIN - 26}
          textAnchor="middle"
          fontSize={13}
          fill="#475569"
          fontWeight={600}
          fontFamily="system-ui, sans-serif"
        >
          {fmtM(feuilleL)}
        </text>

        {/* Cotation verticale (gauche) */}
        <line
          x1={MARGIN - 18}
          y1={MARGIN}
          x2={MARGIN - 18}
          y2={MARGIN + fh}
          stroke="#64748b"
          strokeWidth={1}
        />
        {/* Flèche haut */}
        <line x1={MARGIN - 18} y1={MARGIN} x2={MARGIN - 18 - ARROW / 2} y2={MARGIN + ARROW} stroke="#64748b" strokeWidth={1.2} />
        <line x1={MARGIN - 18} y1={MARGIN} x2={MARGIN - 18 + ARROW / 2} y2={MARGIN + ARROW} stroke="#64748b" strokeWidth={1.2} />
        {/* Flèche bas */}
        <line x1={MARGIN - 18} y1={MARGIN + fh} x2={MARGIN - 18 - ARROW / 2} y2={MARGIN + fh - ARROW} stroke="#64748b" strokeWidth={1.2} />
        <line x1={MARGIN - 18} y1={MARGIN + fh} x2={MARGIN - 18 + ARROW / 2} y2={MARGIN + fh - ARROW} stroke="#64748b" strokeWidth={1.2} />
        {/* Texte H (pivoté) */}
        <text
          x={MARGIN - 26}
          y={MARGIN + fh / 2}
          textAnchor="middle"
          fontSize={13}
          fill="#475569"
          fontWeight={600}
          fontFamily="system-ui, sans-serif"
          transform={`rotate(-90, ${MARGIN - 26}, ${MARGIN + fh / 2})`}
        >
          {fmtM(feuilleH)}
        </text>

        {/* Plaques */}
        {sheet.placements.map((p, i) => {
          const color = colorMap.get(p.nom) || PLAQUE_COLORS[0];
          const px = MARGIN + p.x * SCALE;
          const py = MARGIN + p.y * SCALE;
          const pw = p.largeur * SCALE;
          const ph = p.hauteur * SCALE;
          const letter = indexToLetter(i);

          return (
            <g key={p.enfant_id || i}>
              <rect
                x={px}
                y={py}
                width={pw}
                height={ph}
                fill={color}
                fillOpacity={0.82}
                stroke={darken(color, 0.2)}
                strokeWidth={2}
                rx={4}
              />
              {/* Indicateur rotation */}
              {p.rotated && (
                <text
                  x={px + 8}
                  y={py + 16}
                  fontSize={14}
                  fill="white"
                  fontWeight="bold"
                  opacity={0.9}
                >
                  ↻
                </text>
              )}
              {/* Lettre centrée */}
              <text
                x={px + pw / 2}
                y={py + ph / 2 + 1}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={Math.min(22, Math.max(12, Math.min(pw, ph) * 0.3))}
                fill="white"
                fontWeight={700}
                fontFamily="system-ui, sans-serif"
                style={{ textShadow: "0 1px 3px rgba(0,0,0,0.3)" }}
              >
                {letter}
              </text>
            </g>
          );
        })}

        {/* Chutes */}
        {sheet.chutes.map((c, i) => (
          <rect
            key={`chute-${i}`}
            x={MARGIN + c.x * SCALE}
            y={MARGIN + c.y * SCALE}
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
  };

  // ── Légende ──

  const renderLegend = (sheet: FeuillePlacement) => (
    <div className="mt-3 space-y-1">
      {sheet.placements.map((p, i) => {
        const color = colorMap.get(p.nom) || PLAQUE_COLORS[0];
        return (
          <div key={p.enfant_id || i} className="flex items-center gap-2 text-xs text-gray-600">
            <span
              className="inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold text-white shrink-0"
              style={{ backgroundColor: color }}
            >
              {indexToLetter(i)}
            </span>
            <span className="truncate font-medium text-gray-700">{p.nom}</span>
            <span className="text-gray-400 shrink-0">
              {fmtM(p.largeur)} × {fmtM(p.hauteur)}
            </span>
            {p.rotated && <span className="text-gray-400 text-[10px]">↻</span>}
          </div>
        );
      })}
    </div>
  );

  // ── État "pas de placements" (legacy) ──

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

  // ── Stats ──

  const sheetSurface = feuilleL * feuilleH;
  const usedSurface = current
    ? current.placements.reduce((s, p) => s + p.largeur * p.hauteur, 0)
    : 0;
  const chuteSurface = Math.max(0, sheetSurface - usedSurface);
  const ratio = sheetSurface > 0 ? usedSurface / sheetSurface : 0;

  const totalSurface = feuilles.length * sheetSurface;
  const totalUsed = feuilles.reduce(
    (s, f) => s + f.placements.reduce((ss, p) => ss + p.largeur * p.hauteur, 0),
    0,
  );
  const totalChute = Math.max(0, totalSurface - totalUsed);
  const totalRatio = totalSurface > 0 ? totalUsed / totalSurface : 0;

  // ── Rendu principal ──

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
            ? (
              <>
                {renderSheet(current)}
                {renderLegend(current)}
              </>
            )
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
