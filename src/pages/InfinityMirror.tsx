import React, { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  Sparkles,
  Ruler,
  Zap,
  Eye,
  Layers,
  ChevronUp,
  ChevronDown,
  Sun,
  RotateCcw,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Slider } from "@/components/ui/slider";
import Mirror3D from "@/components/infinity-mirror/Mirror3D";

// ============================================================
// FORMULES (PRD §4)
// ============================================================

const calcPerimeter = (L: number, H: number): number => (2 * (L + H)) / 100;
const calcLedCount = (perimeter: number, density: number): number =>
  Math.round(perimeter * density);

const calcReflections = (R_f: number, R_m: number): number => {
  let n = 0;
  let intensity = 100;
  while (intensity >= 1) {
    intensity = intensity * (R_f / 100) * (R_m / 100);
    if (intensity >= 1) n++;
  }
  return n;
};

const calcVisualDepth = (n: number, d: number): number => n * d;

// ============================================================
// CONSTANTES
// ============================================================

const LED_DENSITIES = [30, 60, 120] as const;

const DEFAULTS = { L: 60, H: 60, d: 3, D_led: 60, R_f: 80, R_m: 92 };
const BRIGHTNESS_MIN = 0.3;
const BRIGHTNESS_MAX = 2.5;
const BRIGHTNESS_STEP = 0.1;

// ============================================================
// COMPOSANT
// ============================================================

const InfinityMirror: React.FC = () => {
  const navigate = useNavigate();

  // Inputs
  const [L, setL] = useState(DEFAULTS.L);
  const [H, setH] = useState(DEFAULTS.H);
  const [d, setD] = useState(DEFAULTS.d);
  const [D_led, setD_led] = useState(DEFAULTS.D_led);
  const [R_f, setR_f] = useState(DEFAULTS.R_f);
  const [R_m, setR_m] = useState(DEFAULTS.R_m);
  const [brightness, setBrightness] = useState(1.0);

  // Footer state
  const [footerExpanded, setFooterExpanded] = useState(false);
  const [showBrightness, setShowBrightness] = useState(false);
  const footerRef = useRef<HTMLDivElement>(null);
  const [footerHeight, setFooterHeight] = useState(56);

  // Calculs dérivés
  const perimeter = useMemo(() => calcPerimeter(L, H), [L, H]);
  const ledCount = useMemo(() => calcLedCount(perimeter, D_led), [perimeter, D_led]);
  const reflections = useMemo(() => calcReflections(R_f, R_m), [R_f, R_m]);
  const visualDepth = useMemo(() => calcVisualDepth(reflections, d), [reflections, d]);

  const reflectionSeries = useMemo(() => {
    const series: number[] = [];
    let intensity = 100;
    for (let i = 0; i <= reflections; i++) {
      series.push(intensity);
      intensity = intensity * (R_f / 100) * (R_m / 100);
    }
    return series;
  }, [reflections, R_f, R_m]);

  // Mesurer la hauteur du footer pour le spacer
  useEffect(() => {
    if (footerRef.current) {
      const h = footerRef.current.offsetHeight;
      setFooterHeight(h > 0 ? h : 56);
    }
  }, [footerExpanded, showBrightness]);

  const resetAll = () => {
    setL(DEFAULTS.L);
    setH(DEFAULTS.H);
    setD(DEFAULTS.d);
    setD_led(DEFAULTS.D_led);
    setR_f(DEFAULTS.R_f);
    setR_m(DEFAULTS.R_m);
    setBrightness(1.0);
  };

  // === RENDER ===
  return (
    <div className="flex flex-col h-screen bg-[#0a0a14] text-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-[#0f0f1a]/80 backdrop-blur-sm shrink-0 z-10">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm hidden sm:inline">Retour</span>
        </button>
        <Sparkles className="h-5 w-5 text-brand-orange" />
        <h1 className="text-lg font-semibold tracking-tight">Simulateur Miroir Infini</h1>
      </div>

      {/* 3D Viewer (plein écran) */}
      <div className="flex-1 relative min-h-0">
        <Mirror3D
          L={L}
          H={H}
          d={d}
          n={reflections}
          R_f={R_f}
          R_m={R_m}
          brightness={brightness}
        />

        {/* Badges overlay */}
        <div className="absolute top-3 left-3 right-3 flex flex-wrap gap-2 pointer-events-none">
          <Badge icon={<Ruler className="h-3.5 w-3.5" />} label="Métrage LED" value={`${perimeter.toFixed(2)} m`} />
          <Badge icon={<Zap className="h-3.5 w-3.5" />} label="Puces LED" value={`${ledCount}`} />
          <Badge icon={<Layers className="h-3.5 w-3.5" />} label="Reflets" value={`${reflections}`} />
          <Badge icon={<Eye className="h-3.5 w-3.5" />} label="Gouffre visuel" value={`${visualDepth} cm`} />
        </div>

        {/* Bouton luminosité (flottant en bas à droite) */}
        <div className="absolute bottom-4 right-4 z-10">
          {showBrightness && (
            <div className="absolute bottom-12 right-0 bg-black/80 backdrop-blur-md rounded-xl p-3 border border-white/10 mb-2 w-48">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Sun className="h-3 w-3" /> Luminosité
                </span>
                <span className="text-xs font-mono text-white">{brightness.toFixed(1)}x</span>
              </div>
              <Slider
                value={[brightness]}
                min={BRIGHTNESS_MIN}
                max={BRIGHTNESS_MAX}
                step={BRIGHTNESS_STEP}
                onValueChange={([v]) => setBrightness(v)}
                className="w-full"
              />
              <button
                onClick={() => setBrightness(1.0)}
                className="mt-2 w-full text-[10px] text-gray-500 hover:text-white transition-colors"
              >
                Réinitialiser
              </button>
            </div>
          )}
          <button
            onClick={() => setShowBrightness(!showBrightness)}
            className={`p-2.5 rounded-full transition-all ${
              showBrightness
                ? "bg-brand-orange text-white shadow-lg shadow-brand-orange/20"
                : "bg-black/60 text-gray-400 hover:text-white border border-white/10 hover:bg-black/80"
            }`}
            title="Luminosité"
          >
            <Sun className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Spacer pour le footer fixe */}
      <div style={{ height: footerHeight }} aria-hidden="true" />

      {/* === STICKY FOOTER (portal) === */}
      {createPortal(
        <div
          ref={footerRef}
          className="fixed bottom-0 left-0 right-0 bg-[#0f0f1a]/95 backdrop-blur-md border-t border-white/10 shadow-lg z-50"
        >
          {/* Barre collapsed / header */}
          <div className="flex items-center gap-2 px-3 py-2">
            {/* Mini-résumé (toujours visible) */}
            <div className="flex-1 flex items-center gap-3 text-xs overflow-x-auto">
              <MiniStat icon={<Ruler className="h-3 w-3 text-brand-orange" />} value={`${perimeter.toFixed(2)} m`} />
              <MiniStat icon={<Zap className="h-3 w-3 text-yellow-400" />} value={`${ledCount} LED`} />
              <MiniStat icon={<Layers className="h-3 w-3 text-cyan-400" />} value={`${reflections} reflets`} />
              <MiniStat icon={<Eye className="h-3 w-3 text-purple-400" />} value={`${visualDepth} cm`} />
            </div>

            {/* Bouton reset (toujours visible) */}
            <button
              onClick={resetAll}
              className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
              title="Réinitialiser"
            >
              <RotateCcw className="h-4 w-4" />
            </button>

            {/* Chevron expand/collapse */}
            <button
              onClick={() => setFooterExpanded(!footerExpanded)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              {footerExpanded ? (
                <ChevronDown className="h-5 w-5" />
              ) : (
                <ChevronUp className="h-5 w-5" />
              )}
            </button>
          </div>

          {/* Contenu expandé */}
          {footerExpanded && (
            <div className="px-3 pb-3 space-y-3 max-h-[45vh] overflow-y-auto">
              {/* Dimensions */}
              <SectionTitle icon={<Ruler className="h-3.5 w-3.5" />} label="Dimensions" />
              <div className="grid grid-cols-3 gap-3">
                <CompactSlider label="Largeur" value={L} min={20} max={150} unit="cm" onChange={setL} />
                <CompactSlider label="Longueur" value={H} min={20} max={150} unit="cm" onChange={setH} />
                <CompactSlider label="Espace" value={d} min={1} max={10} step={0.5} unit="cm" onChange={setD} />
              </div>

              {/* LED */}
              <SectionTitle icon={<Zap className="h-3.5 w-3.5" />} label="Ruban LED" />
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
                    {density} <span className="text-[10px] opacity-70">LED/m</span>
                  </button>
                ))}
              </div>

              {/* Optique */}
              <SectionTitle icon={<Eye className="h-3.5 w-3.5" />} label="Optique" />
              <div className="grid grid-cols-2 gap-3">
                <CompactSlider
                  label="Film sans tain"
                  value={R_f}
                  min={50}
                  max={95}
                  unit="%"
                  onChange={setR_f}
                />
                <CompactSlider
                  label="Miroir de fond"
                  value={R_m}
                  min={80}
                  max={99}
                  unit="%"
                  onChange={setR_m}
                />
              </div>

              {/* Résumé compact */}
              <div className="bg-white/5 rounded-lg p-2.5 grid grid-cols-4 gap-2 text-center">
                <div>
                  <div className="text-[10px] text-gray-500">LED</div>
                  <div className="text-xs font-mono font-semibold text-white">{perimeter.toFixed(2)} m</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500">Puces</div>
                  <div className="text-xs font-mono font-semibold text-white">{ledCount}</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500">Reflets</div>
                  <div className="text-xs font-mono font-semibold text-white">{reflections}</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500">Profondeur</div>
                  <div className="text-xs font-mono font-semibold text-white">{visualDepth} cm</div>
                </div>
              </div>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};

// ============================================================
// SOUS-COMPOSANTS
// ============================================================

const Badge: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({
  icon,
  value,
}) => (
  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-xs">
    <span className="text-brand-orange">{icon}</span>
    <span className="font-semibold text-white">{value}</span>
  </div>
);

const MiniStat: React.FC<{ icon: React.ReactNode; value: string }> = ({ icon, value }) => (
  <div className="flex items-center gap-1 whitespace-nowrap">
    {icon}
    <span className="font-mono font-semibold text-white">{value}</span>
  </div>
);

const SectionTitle: React.FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => (
  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
    {icon}
    {label}
  </div>
);

const CompactSlider: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  onChange: (v: number) => void;
}> = ({ label, value, min, max, step = 1, unit, onChange }) => (
  <div className="space-y-1">
    <div className="flex justify-between items-baseline">
      <span className="text-[10px] text-gray-500">{label}</span>
      <span className="text-xs font-mono font-semibold text-white tabular-nums">
        {value}
        <span className="text-gray-600 ml-0.5">{unit}</span>
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
  </div>
);

export default InfinityMirror;
