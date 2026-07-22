// src/components/cdc-builder/CdcBuilderHeader.tsx
// Bloc d'information collapsible : infos CDC + carte Leaflet de livraison.
// v1 : collapse/expand, map interactive avec marqueur draggable, géocodage.

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  ChevronDown,
  ChevronUp,
  MapPin,
  Loader2,
} from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix icônes Leaflet (bug Vite)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

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
  /** Projets disponibles pour le sélecteur */
  availableProjects?: ProjectOption[];
  /** Chargement des projets */
  loadingProjects?: boolean;
  /** Sélection d'un projet → recharge avec ?projectId=xxx */
  onSelectProject?: (projectId: string) => void;
}

// ── Géocodage Nominatim (OpenStreetMap) ──

async function geocode(query: string): Promise<{ lat: number; lng: number; label: string } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
    const res = await fetch(url, {
      headers: { "Accept-Language": "fr" },
    });
    const data = await res.json();
    if (data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        label: data[0].display_name,
      };
    }
  } catch {}
  return null;
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, {
      headers: { "Accept-Language": "fr" },
    });
    const data = await res.json();
    return data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

// ── Composant ──

const DEFAULT_CENTER: [number, number] = [5.36, -4.01]; // Abidjan
const DEFAULT_ZOOM = 13;

const CdcBuilderHeader: React.FC<CdcBuilderHeaderProps> = ({
  data,
  onChange,
  project,
  availableProjects,
  loadingProjects,
  onSelectProject,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [addressInput, setAddressInput] = useState(data.deliveryAddress?.label || "");
  const [geocoding, setGeocoding] = useState(false);

  // Map refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const isLocked = !!project;
  const hasAddress = !!(data.deliveryAddress?.lat && data.deliveryAddress?.lng);

  // Sync addressInput when data changes externally
  useEffect(() => {
    setAddressInput(data.deliveryAddress?.label || "");
  }, [data.deliveryAddress?.label]);

  // Init map when expanded — toujours afficher, centré sur l'adresse si dispo
  useEffect(() => {
    if (!expanded || !mapContainerRef.current) return;

    const addr = data.deliveryAddress;
    const center: [number, number] = addr
      ? [addr.lat, addr.lng]
      : DEFAULT_CENTER;

    if (!mapInstance.current) {
      mapInstance.current = L.map(mapContainerRef.current, {
        center,
        zoom: addr ? 15 : DEFAULT_ZOOM,
        scrollWheelZoom: !isLocked,
        attributionControl: false,
        zoomControl: true,
        dragging: !isLocked,
      });

      L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
          maxZoom: 19,
        },
      ).addTo(mapInstance.current);

      if (!isLocked) {
        mapInstance.current.on("click", (e: L.LeafletMouseEvent) => {
          placeMarker(e.latlng.lat, e.latlng.lng);
        });
      }
    } else if (addr) {
      mapInstance.current.setView([addr.lat, addr.lng], 15);
    }

    // Nettoyer l'ancien marqueur et replacer
    if (markerRef.current) {
      mapInstance.current.removeLayer(markerRef.current);
      markerRef.current = null;
    }

    if (addr) {
      const marker = L.marker([addr.lat, addr.lng], {
        draggable: !isLocked,
      }).addTo(mapInstance.current!);
      markerRef.current = marker;

      if (!isLocked) {
        marker.on("dragend", async () => {
          const pos = marker.getLatLng();
          const label = await reverseGeocode(pos.lat, pos.lng);
          onChange({
            deliveryAddress: { label, lat: pos.lat, lng: pos.lng },
          });
          setAddressInput(label);
        });
      }
    }
  }, [expanded, data.deliveryAddress?.lat, data.deliveryAddress?.lng, isLocked]);

  const placeMarker = useCallback(
    async (lat: number, lng: number, reverse = true) => {
      const map = mapInstance.current;
      if (!map) return;

      // Supprimer l'ancien marqueur
      if (markerRef.current) {
        map.removeLayer(markerRef.current);
      }

      // Créer nouveau marqueur draggable
      const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
      markerRef.current = marker;

      // Drag → mettre à jour
      marker.on("dragend", async () => {
        const pos = marker.getLatLng();
        const label = await reverseGeocode(pos.lat, pos.lng);
        onChange({
          deliveryAddress: { label, lat: pos.lat, lng: pos.lng },
        });
        setAddressInput(label);
      });

      // Reverse geocode pour avoir le label
      if (reverse) {
        const label = await reverseGeocode(lat, lng);
        onChange({
          deliveryAddress: { label, lat, lng },
        });
        setAddressInput(label);
      } else {
        onChange({
          deliveryAddress: {
            label: data.deliveryAddress?.label || "",
            lat,
            lng,
          },
        });
      }
    },
    [onChange, data.deliveryAddress?.label],
  );

  const handleGeocode = async () => {
    if (!addressInput.trim()) return;
    setGeocoding(true);
    const result = await geocode(addressInput);
    setGeocoding(false);
    if (result) {
      setAddressInput(result.label);
      onChange({
        deliveryAddress: { label: result.label, lat: result.lat, lng: result.lng },
      });
      if (mapInstance.current) {
        mapInstance.current.setView([result.lat, result.lng], 15);
        placeMarker(result.lat, result.lng, false);
      }
    }
  };

  const summaryText = [
    data.projectName || "Sans titre",
    data.cdcNumero && `CDC ${data.cdcNumero}`,
    data.commandeId && `CMD ${data.commandeId}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const cellInput =
    "h-9 border border-gray-200 rounded px-3 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm w-full";

  return (
    <div className="mb-4">
      {/* Barre résumée (toujours visible) */}
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3
                   bg-white border border-gray-200 rounded-lg shadow-sm
                   hover:border-indigo-300 hover:shadow transition-all duration-150"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="text-xl">🏗️</span>
          <div className="min-w-0 text-left">
            <h1 className="text-lg font-bold text-gray-900 truncate">
              CDC Builder
            </h1>
            <p className="text-xs text-gray-500 truncate">{summaryText}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          {hasAddress && (
            <span className="hidden sm:inline-flex items-center gap-1 text-xs text-gray-400">
              <MapPin size={12} />
              Livraison
            </span>
          )}
          {expanded ? (
            <ChevronUp size={18} className="text-gray-400" />
          ) : (
            <ChevronDown size={18} className="text-gray-400" />
          )}
        </div>
      </button>

      {/* Contenu dépliable */}
      {expanded && (
        <div className="mt-3 bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="p-4">
            {/* Sélecteur de projet (si disponible) */}
            {onSelectProject && availableProjects && availableProjects.length > 0 && (
              <div className="mb-5 pb-4 border-b border-gray-100">
                <label className="block text-xs font-medium text-gray-500 mb-2">
                  📂 Projet lié
                </label>
                {loadingProjects ? (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Loader2 size={14} className="animate-spin" />
                    Chargement des projets...
                  </div>
                ) : (
                  <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
                    {availableProjects.map((p) => {
                      const isSelected = project?.id === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => onSelectProject(p.id)}
                          className={`shrink-0 text-xs px-3.5 py-2 rounded-xl border transition-all duration-200
                            ${isSelected
                              ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200"
                              : "bg-white border-gray-200 text-gray-700 hover:border-indigo-300 hover:shadow-sm hover:bg-gray-50"
                            }`}
                        >
                          <span className="flex items-center gap-2">
                            <span className="font-medium">{p.name}</span>
                            {p.hasCommande && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold
                                ${isSelected
                                  ? "bg-indigo-500/30 text-white"
                                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                }`}>
                                CMD
                              </span>
                            )}
                            {p.hasCdc && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold
                                ${isSelected
                                  ? "bg-indigo-500/30 text-white"
                                  : "bg-violet-50 text-violet-700 border border-violet-200"
                                }`}>
                                CDC
                              </span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {project && (
                  <p className="text-xs text-gray-400 mt-2">
                    {project.hasCdc
                      ? "✅ CDC existant chargé — enseignes et matériaux pré-remplis"
                      : project.hasCommande
                        ? "📋 Commande validée trouvée — enseignes créées depuis les items"
                        : "🆕 Nouveau CDC — aucune commande validée liée"}
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Colonne gauche : infos */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Nom du projet
                  </label>
                  <input
                    type="text"
                    value={data.projectName}
                    onChange={(e) => onChange({ projectName: e.target.value })}
                    placeholder="Nom du projet..."
                    disabled={isLocked}
                    className={`${cellInput} ${isLocked ? "bg-gray-50 text-gray-600 cursor-default" : ""}`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      N° CDC
                    </label>
                    <input
                      type="text"
                      value={data.cdcNumero}
                      onChange={(e) => onChange({ cdcNumero: e.target.value })}
                      placeholder="CDC-YYYY-NNN"
                      disabled={isLocked}
                      className={`${cellInput} ${isLocked ? "bg-gray-50 text-gray-600 cursor-default" : ""}`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      N° Commande
                    </label>
                    <input
                      type="text"
                      value={data.commandeId}
                      onChange={(e) => onChange({ commandeId: e.target.value })}
                      placeholder="CMD-YYYY-NNN"
                      disabled={isLocked}
                      className={`${cellInput} ${isLocked ? "bg-gray-50 text-gray-600 cursor-default" : ""}`}
                    />
                  </div>
                </div>

                {/* Adresse de livraison — lecture seule si projet chargé */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    📍 Adresse de livraison
                  </label>
                  {isLocked ? (
                    <div className={`${cellInput} bg-gray-50 text-gray-600 flex items-center cursor-default`}>
                      <MapPin size={14} className="text-gray-400 mr-2 shrink-0" />
                      <span className="truncate text-sm">
                        {data.deliveryAddress?.label || "Aucune adresse"}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
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
                        placeholder="Ex: Abidjan, Cocody, Rue des Jardins..."
                        className={cellInput}
                      />
                      <button
                        type="button"
                        onClick={handleGeocode}
                        disabled={geocoding || !addressInput.trim()}
                        className="shrink-0 h-9 w-9 flex items-center justify-center
                                   bg-indigo-600 text-white rounded-lg
                                   hover:bg-indigo-700 transition-colors
                                   disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Rechercher l'adresse"
                      >
                        {geocoding ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <span className="text-sm">🔍</span>
                        )}
                      </button>
                    </div>
                  )}
                  {hasAddress && (
                    <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                      <MapPin size={10} />
                      {data.deliveryAddress!.lat.toFixed(4)},{" "}
                      {data.deliveryAddress!.lng.toFixed(4)}
                    </p>
                  )}
                </div>
              </div>

              {/* Colonne droite : carte */}
              <div className="relative min-h-[200px]">
                <div className="text-xs font-medium text-gray-500 mb-2">
                  🗺️ Lieu de livraison
                </div>
                <div
                  ref={mapContainerRef}
                  className="w-full rounded-lg border border-gray-200 bg-gray-100 overflow-hidden"
                  style={{ height: "240px" }}
                />
                {!hasAddress && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none mt-6">
                    <div className="text-center text-gray-400 text-sm bg-white/90 px-4 py-2 rounded-lg">
                      <MapPin size={20} className="mx-auto mb-1 opacity-50" />
                      {isLocked
                        ? "Aucune adresse de livraison"
                        : "Recherchez une adresse ou cliquez sur la carte"}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CdcBuilderHeader;
