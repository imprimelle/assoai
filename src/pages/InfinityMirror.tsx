import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft, Sparkles, Ruler, Zap, Eye, Layers,
  ChevronUp, ChevronDown, Sun, RotateCcw, Palette,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Slider } from "@/components/ui/slider";
import Mirror3D, {
  type LedType,
  type LegStyle,
  type SideMaterial,
  type MirrorOptions,
} from "@/components/infinity-mirror/Mirror3D";

// ============================================================
// FORMULES
// ============================================================
const calcPerimeter = (L: number, H: number): number => (2 * (L + H)) / 100;
const calcLedCount = (p: number, d: number): number => Math.round(p * d);
const calcReflections = (R_f: number, R_m: number): number => {
  let n = 0, I = 100;
  while (I >= 1) { I = I * (R_f / 100) * (R_m / 100); if (I >= 1) n++; }
  return n;
};
const calcVisualDepth = (n: number, d: number): number => n * d;

// ============================================================
// CONSTANTES
// ============================================================
const LED_DENSITIES = [30, 60, 120] as const;
const LED_COLORS = [
  { name: "Bleu", hex: "#00aaff", css: "bg-blue-500" },
  { name: "Cyan", hex: "#00ffff", css: "bg-cyan-400" },
  { name: "Violet", hex: "#aa44ff", css: "bg-purple-500" },
  { name: "Blanc", hex: "#ffffff", css: "bg-white" },
  { name: "Vert", hex: "#00ff66", css: "bg-green-400" },
  { name: "Rouge", hex: "#ff3344", css: "bg-red-500" },
  { name: "Orange", hex: "#ff8800", css: "bg-orange-400" },
  { name: "Rose", hex: "#ff44aa", css: "bg-pink-400" },
];
const LED_TYPES: { key: LedType; label: string }[] = [
  { key: "ruban", label: "Ruban" },
  { key: "module", label: "Module" },
  { key: "neon", label: "Néon" },
];
type FooterTab = "dimensions" | "led" | "optique";
const TABS: { key: FooterTab; icon: React.ReactNode; label: string }[] = [
  { key: "dimensions", icon: <Ruler className="h-3.5 w-3.5" />, label: "Dimensions" },
  { key: "led", icon: <Zap className="h-3.5 w-3.5" />, label: "LED" },
  { key: "optique", icon: <Eye className="h-3.5 w-3.5" />, label: "Optique" },
];
const DEFAULTS = { L: 60, H: 60, d: 3, D_led: 60, R_f: 80, R_m: 92 };

// ============================================================
// COMPOSANT
// ============================================================
const InfinityMirror: React.FC = () => {
  const navigate = useNavigate();
  const [L, setL] = useState(DEFAULTS.L);
  const [H, setH] = useState(DEFAULTS.H);
  const [d, setD] = useState(DEFAULTS.d);
  const [D_led, setD_led] = useState(DEFAULTS.D_led);
  const [R_f, setR_f] = useState(DEFAULTS.R_f);
  const [R_m, setR_m] = useState(DEFAULTS.R_m);
  const [brightness, setBrightness] = useState(1.0);
  const [ledColor, setLedColor] = useState("#00aaff");
  const [ledType, setLedType] = useState<LedType>("ruban");
  const [ledPower, setLedPower] = useState(14.4);

  // Mirror options (interactive 3D)
  const [mirrorOptions, setMirrorOptions] = useState<MirrorOptions>({
    showTopGlass: true,
    legStyle: "none",
    sideMaterial: "standard",
  });

  // Contextual popup
  const [popup, setPopup] = useState<{
    part: string; x: number; y: number;
  } | null>(null);

  const [footerExpanded, setFooterExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<FooterTab>("dimensions");
  const [showBrightness, setShowBrightness] = useState(false);
  const footerRef = useRef<HTMLDivElement>(null);
  const [footerHeight, setFooterHeight] = useState(56);

  const perimeter = useMemo(() => calcPerimeter(L, H), [L, H]);
  const ledCount = useMemo(() => calcLedCount(perimeter, D_led), [perimeter, D_led]);
  const reflections = useMemo(() => calcReflections(R_f, R_m), [R_f, R_m]);
  const visualDepth = useMemo(() => calcVisualDepth(reflections, d), [reflections, d]);

  useEffect(() => {
    if (footerRef.current) setFooterHeight(footerRef.current.offsetHeight || 56);
  }, [footerExpanded, activeTab, showBrightness]);

  const resetAll = () => {
    setL(DEFAULTS.L); setH(DEFAULTS.H); setD(DEFAULTS.d);
    setD_led(DEFAULTS.D_led); setR_f(DEFAULTS.R_f); setR_m(DEFAULTS.R_m);
    setBrightness(1.0); setLedColor("#00aaff"); setLedType("ruban"); setLedPower(14.4);
    setMirrorOptions({ showTopGlass: true, legStyle: "none", sideMaterial: "standard" });
  };

  const handlePartClick = useCallback((part: string, screenX: number, screenY: number) => {
    setPopup({ part, x: screenX, y: screenY });
  }, []);

  const closePopup = () => setPopup(null);

  // Build part-specific options
  const popupOptions = useMemo(() => {
    if (!popup) return null;
    const part = popup.part;

    if (part === "topGlass") {
      return {
        title: "Vitre supérieure",
        current: mirrorOptions.showTopGlass ? "Présente" : "Absente",
        actions: [
          { label: mirrorOptions.showTopGlass ? "Retirer la vitre" : "Ajouter une vitre",
            onClick: () => {
              setMirrorOptions(prev => ({ ...prev, showTopGlass: !prev.showTopGlass }));
              closePopup();
            }
          },
        ],
      };
    }

    if (part.startsWith("side")) {
      const sideName = part === "sideFront" ? "Face avant" : part === "sideBack" ? "Face arrière" : part === "sideLeft" ? "Côté gauche" : "Côté droit";
      return {
        title: sideName,
        current: mirrorOptions.sideMaterial === "standard" ? "Standard (métal)" : mirrorOptions.sideMaterial === "glass" ? "Vitre" : "Bois",
        actions: [
          { label: "Standard (métal)", active: mirrorOptions.sideMaterial === "standard",
            onClick: () => { setMirrorOptions(prev => ({ ...prev, sideMaterial: "standard" })); closePopup(); }
          },
          { label: "Vitre", active: mirrorOptions.sideMaterial === "glass",
            onClick: () => { setMirrorOptions(prev => ({ ...prev, sideMaterial: "glass" })); closePopup(); }
          },
          { label: "Bois", active: mirrorOptions.sideMaterial === "wood",
            onClick: () => { setMirrorOptions(prev => ({ ...prev, sideMaterial: "wood" })); closePopup(); }
          },
        ],
      };
    }

    if (part === "leg") {
      return {
        title: "Pieds de table",
        current: mirrorOptions.legStyle === "none" ? "Aucun" : mirrorOptions.legStyle === "metal" ? "Métal" : "Bois",
        actions: [
          { label: "Aucun", active: mirrorOptions.legStyle === "none",
            onClick: () => { setMirrorOptions(prev => ({ ...prev, legStyle: "none" })); closePopup(); }
          },
          { label: "Métal", active: mirrorOptions.legStyle === "metal",
            onClick: () => { setMirrorOptions(prev => ({ ...prev, legStyle: "metal" })); closePopup(); }
          },
          { label: "Bois", active: mirrorOptions.legStyle === "wood",
            onClick: () => { setMirrorOptions(prev => ({ ...prev, legStyle: "wood" })); closePopup(); }
          },
        ],
      };
    }

    return null;
  }, [popup, mirrorOptions]);

  return (
    <div className="flex flex-col h-screen bg-[#0a0a14] text-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-[#0f0f1a]/80 backdrop-blur-sm shrink-0 z-10">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-gray-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm hidden sm:inline">Retour</span>
        </button>
        <Sparkles className="h-5 w-5 text-brand-orange" />
        <h1 className="text-lg font-semibold tracking-tight">Simulateur Miroir Infini</h1>
      </div>

      {/* 3D Viewer */}
      <div className="flex-1 relative min-h-0">
        <Mirror3D
          L={L} H={H} d={d} n={reflections} R_f={R_f} R_m={R_m}
          brightness={brightness} ledColor={ledColor} ledType={ledType} ledPower={ledPower}
          options={mirrorOptions}
          onPartClick={handlePartClick}
        />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-2 pointer-events-none">
          <Badge icon={<Ruler className="h-3.5 w-3.5" />} value={`${perimeter.toFixed(2)} m`} />
          <Badge icon={<Zap className="h-3.5 w-3.5" />} value={`${ledCount} LED`} />
          <Badge icon={<Layers className="h-3.5 w-3.5" />} value={`${reflections} reflets`} />
          <Badge icon={<Eye className="h-3.5 w-3.5" />} value={`${visualDepth} cm`} />
        </div>

        {/* Luminosité */}
        <div className="absolute bottom-4 right-4 z-10">
          {showBrightness && (
            <div className="absolute bottom-12 right-0 bg-black/80 backdrop-blur-md rounded-xl p-3 border border-white/10 mb-2 w-48">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400 flex items-center gap-1"><Sun className="h-3 w-3" /> Luminosité</span>
                <span className="text-xs font-mono text-white">{brightness.toFixed(1)}x</span>
              </div>
              <Slider value={[brightness]} min={0.3} max={2.5} step={0.1} onValueChange={([v]) => setBrightness(v)} />
              <button onClick={() => setBrightness(1.0)} className="mt-2 w-full text-[10px] text-gray-500 hover:text-white">Réinitialiser</button>
            </div>
          )}
          <button onClick={() => setShowBrightness(!showBrightness)}
            className={`p-2.5 rounded-full transition-all ${showBrightness ? "bg-brand-orange text-white shadow-lg shadow-brand-orange/20" : "bg-black/60 text-gray-400 hover:text-white border border-white/10 hover:bg-black/80"}`}>
            <Sun className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div style={{ height: footerHeight }} aria-hidden="true" />

      {/* === STICKY FOOTER === */}
      {createPortal(
        <div ref={footerRef} className="fixed bottom-0 left-0 right-0 bg-[#0f0f1a]/95 backdrop-blur-md border-t border-white/10 shadow-lg z-50">
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="flex-1 flex items-center gap-3 text-xs overflow-x-auto">
              <MiniStat icon={<Ruler className="h-3 w-3 text-brand-orange" />} value={`${perimeter.toFixed(2)} m`} />
              <MiniStat icon={<Zap className="h-3 w-3 text-yellow-400" />} value={`${ledCount} LED`} />
              <MiniStat icon={<Layers className="h-3 w-3 text-cyan-400" />} value={`${reflections} reflets`} />
              <MiniStat icon={<Eye className="h-3 w-3 text-purple-400" />} value={`${visualDepth} cm`} />
              <MiniStat icon={<Palette className="h-3 w-3" style={{ color: ledColor }} />} value={ledType} />
            </div>
            <button onClick={resetAll} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5"><RotateCcw className="h-4 w-4" /></button>
            <button onClick={() => setFooterExpanded(!footerExpanded)} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5">
              {footerExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
            </button>
          </div>

          {footerExpanded && (
            <div className="px-3 pb-3 space-y-3 max-h-[50vh] overflow-y-auto">
              <div className="flex gap-1 bg-white/5 rounded-lg p-0.5">
                {TABS.map(tab => (
                  <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-all ${activeTab === tab.key ? "bg-brand-orange text-white shadow-sm" : "text-gray-400 hover:text-white"}`}>
                    {tab.icon}<span className="hidden sm:inline">{tab.label}</span>
                  </button>
                ))}
              </div>

              {activeTab === "dimensions" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <CompactSlider label="Largeur (L)" value={L} min={20} max={150} unit="cm" onChange={setL} />
                    <CompactSlider label="Longueur (H)" value={H} min={20} max={150} unit="cm" onChange={setH} />
                    <CompactSlider label="Espace (d)" value={d} min={1} max={10} step={0.5} unit="cm" onChange={setD} />
                  </div>
                  {/* Mini visualisation du ratio L×H */}
                  <div className="bg-white/5 rounded-lg p-3 flex items-center gap-4">
                    <div className="relative border border-white/20 rounded" style={{ width: 60, height: 60 * (H / L) }}>
                      <div className="absolute inset-1 border border-brand-orange/40 rounded-sm flex items-center justify-center">
                        <span className="text-[9px] text-brand-orange font-mono">{L}×{H}</span>
                      </div>
                    </div>
                    <div className="flex-1 space-y-1 text-xs">
                      <div className="flex justify-between"><span className="text-gray-500">Périmètre</span><span className="font-mono text-white">{perimeter.toFixed(2)} m</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Surface</span><span className="font-mono text-white">{((L * H) / 10000).toFixed(2)} m²</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Ratio</span><span className="font-mono text-white">{(L / H).toFixed(2)}</span></div>
                    </div>
                  </div>
                  <PhysicalNote d={d} visualDepth={visualDepth} reflections={reflections} />
                </div>
              )}

              {activeTab === "led" && (
                <div className="space-y-3">
                  {/* Preview strip showing LED color + attenuation */}
                  <div className="bg-black/40 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ledColor, boxShadow: `0 0 8px ${ledColor}` }} />
                      <span className="text-xs text-gray-300">Aperçu atténuation sur {reflections} réflexions</span>
                    </div>
                    <div className="flex gap-1 h-6">
                      {Array.from({ length: Math.min(reflections, 12) }).map((_, i) => {
                        const vis = 1.0 - (i / Math.min(reflections, 12)) * 0.85;
                        const rf = Math.pow(R_f / 100, i + 1) * Math.pow(R_m / 100, i + 1);
                        const b = vis * Math.max(0.15, rf);
                        return (
                          <div key={i} className="flex-1 rounded-sm transition-all"
                            style={{
                              backgroundColor: ledColor,
                              opacity: 0.15 + vis * 0.85,
                              boxShadow: `0 0 ${4 + b * 6}px ${ledColor}`,
                            }}
                            title={`Réflexion ${i + 1}: ${(b * 100).toFixed(0)}%`} />
                        );
                      })}
                    </div>
                    <div className="flex justify-between text-[9px] text-gray-600 mt-1">
                      <span>Surface</span>
                      <span>Profondeur</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 block">Densité</label>
                    <div className="flex gap-2">
                      {LED_DENSITIES.map(dens => (
                        <button key={dens} onClick={() => setD_led(dens)}
                          className={`flex-1 py-2.5 rounded-lg text-center transition-all ${
                            D_led === dens
                              ? "bg-brand-orange text-white shadow-lg shadow-brand-orange/20"
                              : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                          }`}>
                          <div className="text-sm font-bold">{dens}</div>
                          <div className="text-[9px] opacity-70">LED/m</div>
                          <div className="text-[10px] mt-0.5 opacity-80">{Math.round(perimeter * dens)} puces</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 block">Type</label>
                    <div className="flex gap-2">
                      {LED_TYPES.map(t => (
                        <button key={t.key} onClick={() => setLedType(t.key)}
                          className={`flex-1 py-2.5 rounded-lg text-center transition-all ${
                            ledType === t.key
                              ? "bg-white/10 text-white border border-white/20 shadow-lg"
                              : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                          }`}>
                          <div className="text-xs font-semibold">{t.label}</div>
                          <div className="text-[9px] opacity-50 mt-0.5">
                            {t.key === "ruban" ? "━ Bande" : t.key === "module" ? "● Points" : "◉ Tubes"}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 block">Couleur</label>
                    <div className="flex flex-wrap gap-1.5">
                      {LED_COLORS.map(c => (
                        <button key={c.hex} onClick={() => setLedColor(c.hex)}
                          className={`w-8 h-8 rounded-full border-2 transition-all ${c.css} ${
                            ledColor === c.hex
                              ? "border-white scale-115 shadow-lg ring-2 ring-white/20"
                              : "border-transparent opacity-70 hover:opacity-100 hover:scale-105"
                          }`}
                          style={ledColor === c.hex ? { boxShadow: `0 0 12px ${c.hex}` } : {}}
                          title={c.name} />
                      ))}
                    </div>
                  </div>

                  <CompactSlider label="Puissance" value={ledPower} min={4.8} max={28.8} step={0.1} unit="W/m" onChange={setLedPower}
                    hint={`${ledPower.toFixed(1)}W/m → ${(ledPower * perimeter).toFixed(1)}W total`} />
                </div>
              )}

              {activeTab === "optique" && (
                <div className="space-y-3">
                  {/* Diagramme de réflexion interactif */}
                  <div className="bg-black/40 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-3">
                      <Eye className="h-4 w-4 text-brand-orange" />
                      <span className="text-xs text-gray-300">Diagramme de réflexion</span>
                    </div>
                    <div className="relative h-16 flex items-end gap-0.5">
                      {Array.from({ length: Math.min(reflections, 10) }).map((_, i) => {
                        const intensity = 100 * Math.pow(R_f / 100, i + 1) * Math.pow(R_m / 100, i + 1);
                        const h = Math.max(5, (intensity / 100) * 64);
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center justify-end" style={{ height: 64 }}>
                            <div
                              className="w-full rounded-t-sm transition-all"
                              style={{
                                height: h,
                                backgroundColor: ledColor,
                                opacity: 0.3 + (intensity / 100) * 0.7,
                              }}
                            />
                            <span className="text-[7px] text-gray-600 mt-0.5">{i + 1}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between text-[9px] text-gray-600 mt-1">
                      <span>Surface (réflexion 1)</span>
                      <span>Profondeur (réflexion {Math.min(reflections, 10)})</span>
                    </div>
                  </div>

                  <CompactSlider label="Film sans tain (R_f)" value={R_f} min={50} max={95} unit="%" onChange={setR_f}
                    hint="Plus c'est élevé, plus le tunnel est profond" />
                  <CompactSlider label="Miroir de fond (R_m)" value={R_m} min={80} max={99} unit="%" onChange={setR_m}
                    hint="Qualité du miroir inférieur" />

                  <div className="bg-white/5 rounded-lg p-3 space-y-2">
                    <h4 className="text-xs font-semibold text-gray-400">Résultat optique</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-gray-500">Intensité initiale</span><div className="font-mono text-white text-lg">100%</div></div>
                      <div><span className="text-gray-500">Après {reflections} réflexions</span>
                        <div className="font-mono text-purple-400 text-lg font-bold">
                          {reflections > 0 ? `${(100 * Math.pow(R_f / 100, reflections) * Math.pow(R_m / 100, reflections)).toFixed(2)}%` : "—"}
                        </div>
                      </div>
                      <div><span className="text-gray-500">Couches visibles</span><div className="font-mono text-cyan-400 text-lg font-bold">{reflections}</div></div>
                      <div><span className="text-gray-500">Perte par bond</span><div className="font-mono text-white text-lg">{((1 - (R_f / 100) * (R_m / 100)) * 100).toFixed(1)}%</div></div>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-white/5 rounded-lg p-2.5 grid grid-cols-4 gap-2 text-center">
                <div><div className="text-[10px] text-gray-500">LED</div><div className="text-xs font-mono font-semibold text-white">{perimeter.toFixed(2)} m</div></div>
                <div><div className="text-[10px] text-gray-500">Puces</div><div className="text-xs font-mono font-semibold text-white">{ledCount}</div></div>
                <div><div className="text-[10px] text-gray-500">Reflets</div><div className="text-xs font-mono font-semibold text-white">{reflections}</div></div>
                <div><div className="text-[10px] text-gray-500">Gouffre</div><div className="text-xs font-mono font-semibold text-white">{visualDepth} cm</div></div>
              </div>
            </div>
          )}
        </div>,
        document.body
      )}

      {/* === POPUP CONTEXTUEL === */}
      {popup && popupOptions && createPortal(
        <div
          className="fixed z-[60] bg-[#1a1a2e] border border-white/15 rounded-xl shadow-2xl p-3 min-w-[180px] backdrop-blur-xl"
          style={{
            left: Math.min(popup.x, window.innerWidth - 200),
            top: Math.min(popup.y, window.innerHeight - 250),
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-white">{popupOptions.title}</h3>
            <button onClick={closePopup} className="text-gray-500 hover:text-white">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="text-[10px] text-gray-500 mb-2">Actuel : {popupOptions.current}</div>
          {/* Actions */}
          <div className="space-y-1">
            {popupOptions.actions.map((action, i) => (
              <button
                key={i}
                onClick={action.onClick}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                  action.active
                    ? "bg-brand-orange/20 text-brand-orange border border-brand-orange/30"
                    : "text-gray-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

// ============================================================
// SOUS-COMPOSANTS
// ============================================================
const Badge: React.FC<{ icon: React.ReactNode; value: string }> = ({ icon, value }) => (
  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-xs">
    <span className="text-brand-orange">{icon}</span>
    <span className="font-semibold text-white">{value}</span>
  </div>
);
const MiniStat: React.FC<{ icon: React.ReactNode; value: string }> = ({ icon, value }) => (
  <div className="flex items-center gap-1 whitespace-nowrap">{icon}<span className="font-mono font-semibold text-white">{value}</span></div>
);
const CompactSlider: React.FC<{
  label: string; value: number; min: number; max: number; step?: number; unit: string;
  onChange: (v: number) => void; hint?: string;
}> = ({ label, value, min, max, step = 1, unit, onChange, hint }) => (
  <div className="space-y-1">
    <div className="flex justify-between items-baseline">
      <span className="text-[10px] text-gray-500">{label}</span>
      <span className="text-xs font-mono font-semibold text-white tabular-nums">{value}<span className="text-gray-600 ml-0.5">{unit}</span></span>
    </div>
    <Slider value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} />
    {hint && <p className="text-[9px] text-gray-600">{hint}</p>}
  </div>
);
const PhysicalNote: React.FC<{ d: number; visualDepth: number; reflections: number }> = ({ d, visualDepth, reflections }) => (
  <div className="bg-white/5 rounded-lg p-2.5 text-xs space-y-1 border border-white/5">
    <div className="flex justify-between"><span className="text-gray-500">Profondeur physique</span><span className="font-mono text-white font-semibold">{d} cm</span></div>
    <div className="flex justify-between"><span className="text-gray-500">Gouffre visuel perçu</span><span className="font-mono text-purple-400 font-semibold">{visualDepth} cm</span></div>
    <div className="text-[10px] text-gray-600 mt-1">La structure fait <strong className="text-white">{d} cm</strong> d'épaisseur. L'illusion donne l'impression de <strong className="text-purple-400">{visualDepth} cm</strong> de profondeur grâce aux {reflections} réflexions.</div>
  </div>
);

export default InfinityMirror;
