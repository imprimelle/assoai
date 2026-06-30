import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { PHASE_CONFIG } from './phaseConfig';
import type { ProjectAddress } from '@/hooks/useProjectsAddresses';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Crosshair, MapPin, AlertTriangle } from 'lucide-react';

interface ProjectMapViewProps {
  addresses: Map<string, ProjectAddress>;
  projects: { id: string; name: string; phase?: string; date_livraison?: string }[];
}

// Fix icônes Leaflet par défaut (bug Vite)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function createProjectIcon(phase: string, name: string, isLate: boolean): L.DivIcon {
  const cfg = PHASE_CONFIG[phase] || PHASE_CONFIG['facturation'];
  const shortName = name.length > 20 ? name.slice(0, 18) + '…' : name;

  const pulseAnimation = isLate ? 'animation: pulse 2s infinite;' : '';

  return L.divIcon({
    className: 'project-map-marker',
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;gap:3px">
        <div style="
          background:white;
          border:1.5px solid ${cfg.hex};
          border-radius:6px;
          padding:2px 8px;
          font-size:10px;
          font-weight:600;
          color:#1F2937;
          white-space:nowrap;
          box-shadow:0 2px 6px rgba(0,0,0,0.12);
          line-height:1.4;
          max-width:180px;
          overflow:hidden;
          text-overflow:ellipsis;
        ">${shortName}</div>
        <div style="
          ${pulseAnimation}
          background:${isLate ? '#EF4444' : cfg.hex};
          width:22px;height:22px;
          border-radius:50%;
          border:2.5px solid white;
          box-shadow:0 3px 8px rgba(0,0,0,0.3);
          position:relative;
        ">
          ${isLate ? '<div style="position:absolute;top:-2px;right:-2px;font-size:10px">⚠️</div>' : ''}
        </div>
      </div>
    `,
    iconSize: [140, 48],
    iconAnchor: [70, 48],
    popupAnchor: [0, -28],
  });
}

export const ProjectMapView: React.FC<ProjectMapViewProps> = ({ addresses, projects }) => {
  const navigate = useNavigate();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const openPopupRef = useRef<L.Popup | null>(null);
  const lastClickedRef = useRef<{ id: string; time: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [activePhases, setActivePhases] = useState<Set<string>>(
    new Set(Object.keys(PHASE_CONFIG).filter(k => k !== 'brouillon'))
  );

  const mappedProjects = projects
    .filter(p => addresses.has(p.id))
    .map(p => ({
      ...p,
      address: addresses.get(p.id)!,
      isLate: p.date_livraison ? new Date(p.date_livraison) < new Date() && p.phase !== 'termine' : false,
    }))
    .filter(p => activePhases.has(p.phase || 'facturation'));

  const closePopup = useCallback(() => {
    if (openPopupRef.current) {
      mapInstance.current?.closePopup(openPopupRef.current);
      openPopupRef.current = null;
    }
    lastClickedRef.current = null;
  }, []);

  const togglePhase = (phase: string) => {
    setActivePhases(prev => {
      const next = new Set(prev);
      if (next.has(phase)) {
        if (next.size > 1) next.delete(phase);
      } else {
        next.add(phase);
      }
      return next;
    });
  };

  const handleGeolocate = useCallback(() => {
    if (!mapInstance.current) return;
    setIsLocating(true);
    mapInstance.current.locate({
      setView: true,
      maxZoom: 14,
      timeout: 10000,
    });
  }, []);

  useEffect(() => {
    const map = mapInstance.current;
    if (map) {
      const onLocationFound = (e: L.LocationEvent) => {
        setIsLocating(false);
        L.circle(e.latlng, {
          radius: e.accuracy / 2,
          color: '#3B82F6',
          fillColor: '#3B82F6',
          fillOpacity: 0.15,
          weight: 2,
        }).addTo(map);
      };
      const onLocationError = () => {
        setIsLocating(false);
      };
      map.on('locationfound', onLocationFound);
      map.on('locationerror', onLocationError);
      return () => {
        map.off('locationfound', onLocationFound);
        map.off('locationerror', onLocationError);
      };
    }
  }, []);

  useEffect(() => {
    if (!mapRef.current || mappedProjects.length === 0) return;

    if (!mapInstance.current) {
      mapInstance.current = L.map(mapRef.current, {
        center: [5.35, -4.01],
        zoom: 7,
        scrollWheelZoom: true,
        attributionControl: true,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(mapInstance.current);

      mapInstance.current.on('click', () => {
        closePopup();
      });
    }

    const map = mapInstance.current;

    markersRef.current.forEach(marker => map.removeLayer(marker));
    markersRef.current.clear();

    const bounds = L.latLngBounds([]);
    mappedProjects.forEach(p => {
      const icon = createProjectIcon(p.phase || 'facturation', p.name, p.isLate);
      const marker = L.marker([p.address.lat, p.address.lng], { icon }).addTo(map);

      const phaseLabel = PHASE_CONFIG[p.phase || 'facturation']?.label || 'Facturation';
      const phaseHex = PHASE_CONFIG[p.phase || 'facturation']?.hex || '#6B7280';
      const deliveryInfo = p.date_livraison
        ? `<div style="margin-top:8px;font-size:12px;color:#6B7280;display:flex;align-items:center;gap:4px">
            📦 Livraison : <strong style="color:${p.isLate ? '#EF4444' : '#374151'}">${format(new Date(p.date_livraison), 'dd MMM yyyy', { locale: fr })}</strong>
            ${p.isLate ? '<span style="color:#EF4444;font-size:10px">⚠️ RETARD</span>' : ''}
          </div>`
        : '';

      const popupContent = `
        <div style="font-family:system-ui,sans-serif;min-width:200px;padding:4px 0">
          <div style="font-size:14px;font-weight:700;margin-bottom:6px;color:#1F2937">${p.name}</div>
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
            <div style="width:10px;height:10px;border-radius:50%;background:${phaseHex};flex-shrink:0"></div>
            <span style="font-size:12px;color:#6B7280">${phaseLabel}</span>
          </div>
          <div style="font-size:12px;color:#6B7280;margin-bottom:2px">
            <span style="display:inline-block;vertical-align:middle;margin-right:4px">📍</span>
            ${p.address.label}
          </div>
          ${deliveryInfo}
          <div style="margin-top:10px;padding-top:8px;border-top:1px solid #F3F4F6;font-size:11px;color:#9CA3AF;text-align:center">
            Cliquez à nouveau pour ouvrir le projet →
          </div>
        </div>
      `;

      const popup = L.popup({
        closeButton: true,
        autoClose: false,
        closeOnClick: false,
        className: 'project-detail-popup',
        maxWidth: 280,
        offset: [0, -10],
      }).setContent(popupContent);

      marker.on('click', () => {
        const now = Date.now();
        const last = lastClickedRef.current;

        if (last && last.id === p.id && now - last.time < 700) {
          closePopup();
          navigate(`/projects/${p.id}`);
          return;
        }

        closePopup();
        lastClickedRef.current = { id: p.id, time: now };
        marker.bindPopup(popup).openPopup();
        openPopupRef.current = popup;
      });

      markersRef.current.set(p.id, marker);
      bounds.extend([p.address.lat, p.address.lng]);
    });

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13, animate: true });
    }

    return () => {};
  }, [mappedProjects.length]);

  // Légende cliquable
  const phaseEntries = Object.entries(PHASE_CONFIG).filter(([k]) => k !== 'brouillon');
  const lateCount = mappedProjects.filter(p => p.isLate).length;

  return (
    <div className="space-y-3">
      {/* Barre d'outils */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Légende interactive */}
        <div className="flex flex-wrap items-center gap-1.5">
          {phaseEntries.map(([key, cfg]) => {
            const count = mappedProjects.filter(p => (p.phase || 'facturation') === key).length;
            const isActive = activePhases.has(key);
            return (
              <button
                key={key}
                onClick={() => togglePhase(key)}
                className={`
                  flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium
                  transition-all duration-150 border
                  ${isActive
                    ? 'bg-white border-gray-300 shadow-sm text-gray-700'
                    : 'bg-gray-50 border-gray-100 text-gray-300 line-through'
                  }
                `}
              >
                <div
                  className="w-2 h-2 rounded-full border border-white shadow-sm"
                  style={{ backgroundColor: cfg.hex, opacity: isActive ? 1 : 0.3 }}
                />
                {cfg.label}
                {count > 0 && (
                  <Badge variant="secondary" className="h-3.5 px-1 text-[9px] leading-none">
                    {count}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>

        {/* Boutons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={handleGeolocate}
            disabled={isLocating}
          >
            <Crosshair className={`h-3 w-3 ${isLocating ? 'animate-spin' : ''}`} />
            {isLocating ? 'Localisation...' : 'Me localiser'}
          </Button>
        </div>
      </div>

      {/* État vide */}
      {mappedProjects.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
          <MapPin className="h-14 w-14 mx-auto text-muted-foreground/15 mb-4" />
          <p className="text-muted-foreground text-lg mb-2">
            Aucun projet avec adresse de livraison
          </p>
          <p className="text-sm text-muted-foreground/70 max-w-md mx-auto">
            {projects.length === 0
              ? 'Créez un projet pour commencer.'
              : activePhases.size === 0
                ? 'Sélectionnez au moins une phase dans la légende.'
                : 'Les adresses sont extraites des commandes liées aux projets. Ajoutez une commande avec une adresse de livraison.'
            }
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* Carte */}
          <div
            ref={mapRef}
            className="w-full rounded-xl border shadow-sm"
            style={{ height: '520px', maxHeight: 'calc(100vh - 320px)' }}
          />

          {/* Badge projets en retard */}
          {lateCount > 0 && (
            <div className="absolute top-3 right-3 z-[1000]">
              <Badge className="bg-red-500 hover:bg-red-600 text-white text-xs gap-1.5 px-2.5 py-1 shadow-lg">
                <AlertTriangle className="h-3 w-3" />
                {lateCount} retard{lateCount > 1 ? 's' : ''}
              </Badge>
            </div>
          )}
        </div>
      )}

      {/* Compteur */}
      {mappedProjects.length > 0 && (
        <div className="text-xs text-muted-foreground text-right">
          {mappedProjects.length} projet{mappedProjects.length !== 1 ? 's' : ''} affiché{mappedProjects.length !== 1 ? 's' : ''}
          {' '}sur {projects.length}
        </div>
      )}
    </div>
  );
};
