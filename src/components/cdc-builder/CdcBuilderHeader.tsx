// src/components/cdc-builder/CdcBuilderHeader.tsx
// v3 — Collapsible, replié par défaut. Projet lié via @ dropdown.

import React, { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, MapPin, ChevronDown, ChevronUp } from "lucide-react";

// ── Types ──

export interface ProjectOption {
  id: string;
  name: string;
  hasCommande: boolean;
  hasCdc?: boolean;
  commandeId?: string;
  cdcNumero?: string;
  phase?: string;
  status?: string;
}

export interface CdcBuilderHeaderData {
  projectName: string;
  cdcNumero: string;
  commandeId: string;
  statut: string;
  deliveryAddress?: {
    label: string;
    lat: number;
    lng: number;
  };
}

export interface CdcBuilderHeaderProps {
  data: CdcBuilderHeaderData;
  onChange: (changes: Partial<CdcBuilderHeaderData>) => void;
  /** Projet courant (si chargé) */
  project?: ProjectOption | null;
  /** Projets disponibles pour le dropdown */
  availableProjects?: ProjectOption[];
  /** Chargement des projets */
  loadingProjects?: boolean;
  /** Sélection d'un projet → recharge avec ?projectId=xxx */
  onSelectProject?: (projectId: string) => void;
  /** Délier le projet courant */
  onUnlinkProject?: () => void;
  /** Nombre d'enseignes (affiché dans le chip projet) */
  enseigneCount?: number;
}

// ── Géocodage Nominatim ──

async function geocode(query: string): Promise<{ lat: number; lng: number; label: string } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
    const res = await fetch(url, { headers: { "Accept-Language": "fr" } });
    const data = await res.json();
    if (data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), label: data[0].display_name };
    }
  } catch {}
  return null;
}

// ── Composant ──

const CdcBuilderHeader: React.FC<CdcBuilderHeaderProps> = ({
  data,
  onChange,
  project,
  availableProjects,
  loadingProjects,
  onSelectProject,
  onUnlinkProject,
  enseigneCount = 0,
}) => {
  const [expanded, setExpanded] = useState(false);

  // -- Projet @ dropdown --
  const [projectInput, setProjectInput] = useState("");
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const projectDropdownRef = useRef<HTMLDivElement>(null);
  const projectWrapperRef = useRef<HTMLDivElement>(null);

  // -- Adresse --
  const [addressInput, setAddressInput] = useState(data.deliveryAddress?.label || "");
  const [geocoding, setGeocoding] = useState(false);

  useEffect(() => {
    setAddressInput(data.deliveryAddress?.label || "");
  }, [data.deliveryAddress?.label]);

  // Projets filtrés
  const filteredProjects = useMemo(() => {
    const query = projectInput.toLowerCase();
    if (!query) return availableProjects || [];
    return (availableProjects || []).filter((p) =>
      p.name.toLowerCase().includes(query),
    );
  }, [availableProjects, projectInput]);

  useEffect(() => { setActiveIdx(0); }, [projectInput]);

  // Click outside
  useEffect(() => {
    if (!showProjectDropdown) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideWrapper = projectWrapperRef.current?.contains(target);
      const insideDropdown = projectDropdownRef.current?.contains(target);
      if (!insideWrapper && !insideDropdown) setShowProjectDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showProjectDropdown]);

  // Position dropdown
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  useEffect(() => {
    if (showProjectDropdown && projectInputRef.current) {
      const rect = projectInputRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: "fixed",
        left: `${rect.left}px`,
        top: `${rect.bottom + 4}px`,
        minWidth: `${Math.max(rect.width, 320)}px`,
        zIndex: 9999,
      });
    }
  }, [showProjectDropdown, projectInput]);

  const handleSelectProject = (p: ProjectOption) => {
    setProjectInput("");
    setShowProjectDropdown(false);
    onSelectProject?.(p.id);
  };

  const handleProjectKeyDown = (e: React.KeyboardEvent) => {
    if (!showProjectDropdown || filteredProjects.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((p) => (p + 1) % filteredProjects.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((p) => (p - 1 + filteredProjects.length) % filteredProjects.length); }
    else if (e.key === "Enter") { e.preventDefault(); if (filteredProjects[activeIdx]) handleSelectProject(filteredProjects[activeIdx]); }
    else if (e.key === "Escape") { setShowProjectDropdown(false); }
  };

  const handleGeocode = async () => {
    if (!addressInput.trim()) return;
    setGeocoding(true);
    const result = await geocode(addressInput);
    setGeocoding(false);
    if (result) {
      setAddressInput(result.label);
      onChange({ deliveryAddress: { label: result.label, lat: result.lat, lng: result.lng } });
    }
  };

  const cellInput =
    "h-9 border border-gray-200 rounded-lg px-3 bg-white text-sm text-gray-700 placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none w-full";

  const title = project ? project.name : "CDC Builder";

  // ── Badges conditionnels pour la barre collapsed ──
  const cdcId = project?.cdcNumero || data.cdcNumero;
  const cmdId = project?.commandeId || data.commandeId;
  const cdcStatut = data.statut;

  const st = (cdcStatut || "").toLowerCase();
  const statutBadgeClass =
    st === "terminé" || st === "validé" || st === "valide" || st === "livré" || st === "payé"
      ? "bg-green-100 text-green-700 border-green-200"
      : st === "fabrication"
        ? "bg-orange-100 text-orange-700 border-orange-200"
        : st === "vérification"
          ? "bg-amber-100 text-amber-700 border-amber-200"
          : st === "installation"
            ? "bg-indigo-100 text-indigo-700 border-indigo-200"
            : st === "achat"
              ? "bg-blue-100 text-blue-700 border-blue-200"
              : "bg-gray-100 text-gray-600 border-gray-200";

  return (
    <div className="mb-4">
      {/* Barre résumée (toujours visible, cliquable) */}
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-2.5
                   bg-white border border-gray-200 rounded-lg shadow-sm
                   hover:border-indigo-300 hover:shadow transition-all duration-150"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="text-lg shrink-0">🏗️</span>
          <div className="min-w-0 text-left flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-gray-800">{title}</span>
            {/* Badge CDC */}
            {cdcId && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 font-mono font-semibold border border-violet-200">
                {cdcId}
              </span>
            )}
            {/* Badge Commande */}
            {cmdId && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-mono font-semibold border border-emerald-200">
                {cmdId}
              </span>
            )}
            {/* Badge statut CDC */}
            {cdcStatut && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border inline-flex items-center gap-1 ${statutBadgeClass}`}>
                {["vérification", "achat", "fabrication", "installation"].includes(st) && (
                  <Loader2 size={10} className="animate-spin shrink-0" />
                )}
                {cdcStatut}
              </span>
            )}
            {/* Nombre d'enseignes */}
            {enseigneCount > 0 && (
              <span className="text-[10px] text-gray-400 font-medium">{enseigneCount} ens.</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          {data.deliveryAddress?.label && (
            <MapPin size={12} className="text-gray-300 hidden sm:block" />
          )}
          {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>

      {/* Contenu dépliable */}
      {expanded && (
        <div className="mt-2 bg-white border border-gray-200 rounded-lg shadow-sm p-4">
          {/* Projet lié */}
          <div className="mb-3">
            <label className="block text-[11px] font-medium text-gray-400 mb-1">📂 Projet lié</label>

            {project ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg text-xs">
                <span className="font-medium text-indigo-700">{project.name}</span>
                {enseigneCount > 0 && (
                  <span className="text-[10px] text-indigo-500 font-medium">{enseigneCount} ens.</span>
                )}
                {project.hasCommande && (
                  <span className="text-[10px] px-1 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">CMD ✓</span>
                )}
                {project.hasCdc && (
                  <span className="text-[10px] px-1 py-0.5 rounded-full bg-violet-100 text-violet-700 font-semibold">CDC</span>
                )}
                <button type="button" onClick={() => onUnlinkProject?.()} className="ml-1 p-0.5 rounded-full text-indigo-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Délier le projet">
                  <X size={12} />
                </button>
              </div>
            ) : loadingProjects ? (
              <div className="flex items-center gap-2 text-xs text-gray-400 py-1"><Loader2 size={12} className="animate-spin" /> Chargement…</div>
            ) : (
              <div ref={projectWrapperRef}>
                <input ref={projectInputRef} type="text" value={projectInput}
                  onChange={(e) => { setProjectInput(e.target.value); setShowProjectDropdown(true); }}
                  onFocus={() => { if (availableProjects?.length) setShowProjectDropdown(true); }}
                  onKeyDown={handleProjectKeyDown}
                  placeholder="@ Chercher un projet à lier…" className={`${cellInput} h-8 text-xs`} />
              </div>
            )}

            {showProjectDropdown && filteredProjects.length > 0 && createPortal(
              <div ref={projectDropdownRef} style={dropdownStyle} className="bg-white border border-gray-200 rounded-xl shadow-xl max-h-56 overflow-y-auto py-1">
                {filteredProjects.map((p, idx) => {
                  const isSelected = project?.id === p.id;
                  return (
                    <button key={p.id} type="button" onClick={() => handleSelectProject(p)}
                      className={`w-full text-left flex items-center gap-2 px-3 py-2 text-xs transition-colors ${idx === activeIdx || isSelected ? "bg-indigo-50 text-indigo-700" : "text-gray-700 hover:bg-gray-50"}`}>
                      <span className="font-medium flex-1 truncate">{p.name}</span>
                      {p.hasCommande && <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">CMD ✓</span>}
                      {p.hasCdc && <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 font-semibold">CDC</span>}
                      {isSelected && <span className="shrink-0 text-[10px] text-indigo-400">✓</span>}
                    </button>
                  );
                })}
              </div>,
              document.body,
            )}
          </div>

          {/* CDC# + Commande# */}
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-medium text-gray-400">N° CDC</label>
              <span className="text-xs font-mono text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-2.5 h-8 flex items-center min-w-[120px]">{data.cdcNumero || "—"}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-medium text-gray-400">N° CMD</label>
              <span className="text-xs font-mono text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-2.5 h-8 flex items-center min-w-[120px]">{data.commandeId || "—"}</span>
            </div>
          </div>

          {/* Adresse */}
          <div>
            <label className="block text-[11px] font-medium text-gray-400 mb-1">
              <MapPin size={11} className="inline mr-1 text-gray-300" /> Adresse de livraison
            </label>
            <div className="flex items-center gap-1.5">
              <input type="text" value={addressInput}
                onChange={(e) => setAddressInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleGeocode(); } }}
                placeholder="Ex: Abidjan, Cocody…" className={cellInput} />
              <button type="button" onClick={handleGeocode} disabled={geocoding || !addressInput.trim()}
                className="shrink-0 h-9 w-9 flex items-center justify-center bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed" title="Géocoder l'adresse">
                {geocoding ? <Loader2 size={14} className="animate-spin" /> : <span className="text-sm">🔍</span>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CdcBuilderHeader;
