// src/components/cdc-builder/CdcBuilderHeader.tsx
// v2 — Toujours visible, compact. Projet lié via @ dropdown. Pas de carte Leaflet.

import React, { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, MapPin } from "lucide-react";

// ── Types ──

export interface ProjectOption {
  id: string;
  name: string;
  hasCommande: boolean;
  hasCdc?: boolean;
}

export interface CdcBuilderHeaderData {
  projectName: string;
  cdcNumero: string;
  commandeId: string;
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
}

// ── Géocodage Nominatim (conservé, sans carte) ──

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
}) => {
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

  // Sync externe
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

  // Navigation clavier dropdown
  useEffect(() => {
    setActiveIdx(0);
  }, [projectInput]);

  // Click outside → fermer dropdown
  useEffect(() => {
    if (!showProjectDropdown) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideWrapper = projectWrapperRef.current?.contains(target);
      const insideDropdown = projectDropdownRef.current?.contains(target);
      if (!insideWrapper && !insideDropdown) {
        setShowProjectDropdown(false);
      }
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

  const handleProjectInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setProjectInput(val);
    setShowProjectDropdown(true);
  };

  const handleProjectInputFocus = () => {
    if (availableProjects && availableProjects.length > 0) {
      setShowProjectDropdown(true);
    }
  };

  const handleSelectProject = (p: ProjectOption) => {
    setProjectInput("");
    setShowProjectDropdown(false);
    onSelectProject?.(p.id);
  };

  const handleProjectKeyDown = (e: React.KeyboardEvent) => {
    if (!showProjectDropdown || filteredProjects.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((prev) => (prev + 1) % filteredProjects.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((prev) => (prev - 1 + filteredProjects.length) % filteredProjects.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredProjects[activeIdx]) {
        handleSelectProject(filteredProjects[activeIdx]);
      }
    } else if (e.key === "Escape") {
      setShowProjectDropdown(false);
    }
  };

  // Adresse
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

  const statutTexte = project
    ? project.hasCdc
      ? "✅ CDC existant chargé"
      : project.hasCommande
        ? "📋 Commande validée trouvée"
        : "🆕 Nouveau CDC"
    : null;

  return (
    <div className="mb-4 bg-white border border-gray-200 rounded-lg shadow-sm p-4">
      {/* Ligne 1 : Titre + statut */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🏗️</span>
        <h1 className="text-sm font-bold text-gray-800">CDC Builder</h1>
        {statutTexte && (
          <span className="text-[11px] text-gray-400">{statutTexte}</span>
        )}
      </div>

      {/* Ligne 2 : Projet lié — input @ avec dropdown */}
      <div className="mb-3">
        <div className="relative" ref={projectWrapperRef}>
          <label className="block text-[11px] font-medium text-gray-400 mb-1">📂 Projet lié</label>

          {project ? (
            /* Projet sélectionné → chip avec croix */
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg text-xs">
                <span className="font-medium text-indigo-700">{project.name}</span>
                {project.hasCommande && (
                  <span className="text-[10px] px-1 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">
                    CMD ✓
                  </span>
                )}
                {project.hasCdc && (
                  <span className="text-[10px] px-1 py-0.5 rounded-full bg-violet-100 text-violet-700 font-semibold">
                    CDC
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onUnlinkProject?.();
                    setProjectInput("");
                  }}
                  className="ml-1 p-0.5 rounded-full text-indigo-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="Délier le projet"
                >
                  <X size={12} />
                </button>
              </div>
              {/* Input pour chercher un autre projet */}
              <input
                ref={projectInputRef}
                type="text"
                value={projectInput}
                onChange={handleProjectInputChange}
                onFocus={handleProjectInputFocus}
                onKeyDown={handleProjectKeyDown}
                placeholder="ou @ pour changer…"
                className="flex-1 h-8 border-0 border-b border-gray-200 bg-transparent text-xs text-gray-500 placeholder:text-gray-300 focus:border-indigo-300 focus:ring-0 outline-none"
              />
            </div>
          ) : loadingProjects ? (
            <div className="flex items-center gap-2 text-xs text-gray-400 py-1">
              <Loader2 size={12} className="animate-spin" />
              Chargement des projets…
            </div>
          ) : (
            /* Pas de projet → input @ */
            <input
              ref={projectInputRef}
              type="text"
              value={projectInput}
              onChange={handleProjectInputChange}
              onFocus={handleProjectInputFocus}
              onKeyDown={handleProjectKeyDown}
              placeholder="@ Chercher un projet à lier…"
              className={`${cellInput} h-8 text-xs`}
            />
          )}
        </div>

        {/* Dropdown portal */}
        {showProjectDropdown &&
          filteredProjects.length > 0 &&
          createPortal(
            <div
              ref={projectDropdownRef}
              style={dropdownStyle}
              className="bg-white border border-gray-200 rounded-xl shadow-xl max-h-56 overflow-y-auto py-1"
            >
              {filteredProjects.map((p, idx) => {
                const isSelected = project?.id === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectProject(p)}
                    className={`w-full text-left flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
                      idx === activeIdx || isSelected
                        ? "bg-indigo-50 text-indigo-700"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <span className="font-medium flex-1 truncate">{p.name}</span>
                    {p.hasCommande && (
                      <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">
                        CMD ✓
                      </span>
                    )}
                    {p.hasCdc && (
                      <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 font-semibold">
                        CDC
                      </span>
                    )}
                    {isSelected && (
                      <span className="shrink-0 text-[10px] text-indigo-400">✓</span>
                    )}
                  </button>
                );
              })}
            </div>,
            document.body,
          )}
      </div>

      {/* Ligne 3 : CDC#, Commande#, Adresse */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-[11px] font-medium text-gray-400 mb-1">
            N° CDC
          </label>
          <input
            type="text"
            value={data.cdcNumero}
            onChange={(e) => onChange({ cdcNumero: e.target.value })}
            placeholder="CDC-YYYY-NNN"
            className={cellInput}
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-400 mb-1">
            N° Commande
          </label>
          <input
            type="text"
            value={data.commandeId}
            onChange={(e) => onChange({ commandeId: e.target.value })}
            placeholder="CMD-YYYY-NNN"
            className={cellInput}
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-400 mb-1">
            <MapPin size={11} className="inline mr-1 text-gray-300" />
            Adresse de livraison
          </label>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={addressInput}
              onChange={(e) => setAddressInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleGeocode();
                }
              }}
              placeholder="Ex: Abidjan, Cocody…"
              className={cellInput}
            />
            <button
              type="button"
              onClick={handleGeocode}
              disabled={geocoding || !addressInput.trim()}
              className="shrink-0 h-9 w-9 flex items-center justify-center
                         bg-indigo-600 text-white rounded-lg
                         hover:bg-indigo-700 transition-colors
                         disabled:opacity-40 disabled:cursor-not-allowed"
              title="Géocoder l'adresse"
            >
              {geocoding ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <span className="text-sm">🔍</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CdcBuilderHeader;
