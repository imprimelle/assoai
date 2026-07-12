import React, { useState, useMemo, useCallback } from "react";
import { ArrowLeft, Sparkles, Ruler, Zap, Eye, Layers } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Slider } from "@/components/ui/slider";
import Mirror3D from "@/components/infinity-mirror/Mirror3D";

// ============================================================
// FORMULES (PRD §4)
// ============================================================

/** Périmètre de découpe en mètres : P = 2*(L + H) / 100 */
const calcPerimeter = (L: number, H: number): number =>
  (2 * (L + H)) / 100;

/** Nombre de puces LED : N = P * D_led */
const calcLedCount = (perimeter: number, density: number): number =>
  Math.round(perimeter * density);

/** Boucle optique : compte les reflets avant extinction < 1% */
const calcReflections = (R_f: number, R_m: number): number => {
  let n = 0;
  let intensity = 100;
  while (intensity >= 1) {
    intensity = intensity * (R_f / 100) * (R_m / 100);
    if (intensity >= 1) n++;
  }
  return n;
};

/** Profondeur visuelle : D_visuelle = n * d (cm) */
const calcVisualDepth = (n: number, d: number): number => n * d;

// ============================================================
// CONSTANTES
// ============================================================

const LED_DENSITIES = [30, 60, 120] as const;

const DEFAULT_VALUES = {
  L: 60,
  H: 60,
  d: 3,
  D_led: 60,
  R_f: 80,
  R_m: 92,
};

// ============================================================
// COMPOSANT
// ============================================================

const InfinityMirror: React.FC = () => {
  const navigate = useNavigate();

  // Inputs
  const [L, setL] = useState(DEFAULT_VALUES.L);
  const [H, setH] = useState(DEFAULT_VALUES.H);
  const [d, setD] = useState(DEFAULT_VALUES.d);
  const [D_led, setD_led] = useState(DEFAULT_VALUES.D_led);
  const [R_f, setR_f] = useState(DEFAULT_VALUES.R_f);
  const [R_m, setR_m] = useState(DEFAULT_VALUES.R_m);

  // Calculs dérivés (instantanés)
  const perimeter = useMemo(() => calcPerimeter(L, H), [L, H]);
  const ledCount = useMemo(() => calcLedCount(perimeter, D_led), [perimeter, D_led]);
  const reflections = useMemo(() => calcReflections(R_f, R_m), [R_f, R_m]);
  const visualDepth = useMemo(() => calcVisualDepth(reflections, d), [reflections, d]);

  // Intensités pour le modèle 3D (calculées pour chaque niveau)
  const reflectionSeries = useMemo(() => {
    const series: number[] = [];
    let intensity = 100;
    for (let i = 0; i <= reflections; i++) {
      series.push(intensity);
      intensity = intensity * (R_f / 100) * (R_m / 100);
    }
    return series;
  }, [reflections, R_f, R_m]);

  return (
    <div className="flex flex-col h-screen bg-[#0a0a14] text-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-[#0f0f1a]/80 backdrop-blur-sm shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm hidden sm:inline">Retour</span>
        </button>
        <Sparkles className="h-5 w-5 text-brand-orange" />
        <h1 className="text-lg font-semibold tracking-tight">
          Simulateur Miroir Infini
        </h1>
      </div>

      {/* Main content: 3D view + controls */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* 3D Viewer */}
        <div className="flex-1 min-h-[350px] lg:min-h-0 relative">
          <Mirror3D L={L} H={H} d={d} n={reflections} R_f={R_f} R_m={R_m} />
          {/* Output badges overlay */}
          <div className="absolute top-3 left-3 right-3 flex flex-wrap gap-2 pointer-events-none">
            <OutputBadge
              icon={<Ruler className="h-3.5 w-3.5" />}
              label="Métrage LED"
              value={`${perimeter.toFixed(2)} m`}
            />
            <OutputBadge
              icon={<Zap className="h-3.5 w-3.5" />}
              label="Puces LED"
              value={`${ledCount}`}
            />
            <OutputBadge
              icon={<Layers className="h-3.5 w-3.5" />}
              label="Reflets"
              value={`${reflections}`}
            />
            <OutputBadge
              icon={<Eye className="h-3.5 w-3.5" />}
              label="Gouffre visuel"
              value={`${visualDepth} cm`}
            />
          </div>
        </div>

        {/* Controls panel */}
        <div className="w-full lg:w-80 xl:w-96 bg-[#0f0f1a]/95 border-t lg:border-t-0 lg:border-l border-white/10 overflow-y-auto shrink-0">
          <div className="p-4 space-y-6">
            {/* Dimensions */}
            <ControlGroup title="Dimensions du cadre" icon={<Ruler className="h-4 w-4" />}>
              <SliderControl
                label="Largeur (L)"
                value={L}
                min={20}
                max={150}
                step={1}
                unit="cm"
                onChange={setL}
              />
              <SliderControl
                label="Longueur (H)"
                value={H}
                min={20}
                max={150}
                step={1}
                unit="cm"
                onChange={setH}
              />
              <SliderControl
                label="Espace interne (d)"
                value={d}
                min={1}
                max={10}
                step={0.5}
                unit="cm"
                onChange={setD}
                hint="Distance miroir ↔ plexi"
              />
            </ControlGroup>

            {/* LED */}
            <ControlGroup title="Ruban LED" icon={<Zap className="h-4 w-4" />}>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Densité (LED/m)
                </label>
                <div className="flex gap-2">
                  {LED_DENSITIES.map((density) => (
                    <button
                      key={density}
                      onClick={() => setD_led(density)}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                        D_led === density
                          ? "bg-brand-orange text-white shadow-lg shadow-brand-orange/20"
                          : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {density}
                    </button>
                  ))}
                </div>
              </div>
            </ControlGroup>

            {/* Optical */}
            <ControlGroup title="Optique" icon={<Eye className="h-4 w-4" />}>
              <SliderControl
                label="Réflectivité film sans tain"
                value={R_f}
                min={50}
                max={95}
                step={1}
                unit="%"
                onChange={setR_f}
              />
              <SliderControl
                label="Qualité miroir de fond"
                value={R_m}
                min={80}
                max={99}
                step={1}
                unit="%"
                onChange={setR_m}
              />
            </ControlGroup>

            {/* Summary card */}
            <div className="bg-white/5 rounded-xl p-4 space-y-3 border border-white/10">
              <h4 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-brand-orange" />
                Résumé atelier
              </h4>
              <div className="space-y-2 text-sm">
                <SummaryRow label="Périmètre de découpe" value={`${perimeter.toFixed(2)} m`} />
                <SummaryRow label={`LED (${D_led}/m)`} value={`${ledCount} puces`} />
                <SummaryRow label="Couches de lumière" value={`${reflections} reflets`} />
                <SummaryRow label="Profondeur perçue" value={`${visualDepth} cm`} />
                {reflections > 0 && (
                  <SummaryRow
                    label="Intensité finale"
                    value={`${reflectionSeries[reflections]?.toFixed(1)}%`}
                    dim
                  />
                )}
              </div>
            </div>

            {/* Reset button */}
            <button
              onClick={() => {
                setL(DEFAULT_VALUES.L);
                setH(DEFAULT_VALUES.H);
                setD(DEFAULT_VALUES.d);
                setD_led(DEFAULT_VALUES.D_led);
                setR_f(DEFAULT_VALUES.R_f);
                setR_m(DEFAULT_VALUES.R_m);
              }}
              className="w-full py-2 px-4 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors border border-white/10"
            >
              Réinitialiser les valeurs
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// SOUS-COMPOSANTS
// ============================================================

const ControlGroup: React.FC<{
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, icon, children }) => (
  <div className="space-y-4">
    <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
      {icon}
      {title}
    </h3>
    {children}
  </div>
);

const SliderControl: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
  hint?: string;
}> = ({ label, value, min, max, step, unit, onChange, hint }) => (
  <div className="space-y-1.5">
    <div className="flex justify-between items-baseline">
      <label className="text-xs text-gray-400">{label}</label>
      <span className="text-sm font-mono font-semibold text-white tabular-nums">
        {value}
        <span className="text-gray-500 text-xs ml-0.5">{unit}</span>
      </span>
    </div>
    <Slider
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={([v]) => onChange(v)}
      className="w-full"
    />
    {hint && <p className="text-[10px] text-gray-600">{hint}</p>}
  </div>
);

const OutputBadge: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
}> = ({ icon, label, value }) => (
  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-xs">
    <span className="text-brand-orange">{icon}</span>
    <span className="text-gray-400">{label}:</span>
    <span className="font-semibold text-white">{value}</span>
  </div>
);

const SummaryRow: React.FC<{
  label: string;
  value: string;
  dim?: boolean;
}> = ({ label, value, dim }) => (
  <div className="flex justify-between items-center">
    <span className={dim ? "text-gray-600" : "text-gray-400"}>{label}</span>
    <span className={`font-mono font-semibold tabular-nums ${dim ? "text-gray-600" : "text-white"}`}>
      {value}
    </span>
  </div>
);

export default InfinityMirror;
