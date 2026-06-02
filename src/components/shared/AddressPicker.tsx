
import React, { useState, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { SearchIcon } from 'lucide-react';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DeliveryAddress } from '@/types/material';

// Fix the default icon issue
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

const DEFAULT_LAT = 48.8588897;
const DEFAULT_LNG = 2.320041;

interface AddressPickerProps {
  value?: DeliveryAddress;
  isEditable?: boolean;
  onChange?: (address: DeliveryAddress) => void;
  required?: boolean;
}

// Component pour gérer les événements de la carte
function MapEventHandler({ 
  onMapClick 
}: { 
  onMapClick: (lat: number, lng: number) => void 
}) {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });

  return null;
}

const AddressPicker: React.FC<AddressPickerProps> = ({
  value,
  isEditable = false,
  onChange,
  required = false
}) => {
  const [address, setAddress] = useState<string>(value?.label || '');
  const [position, setPosition] = useState<[number, number]>([
    value?.lat || DEFAULT_LAT,
    value?.lng || DEFAULT_LNG
  ]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [mapKey, setMapKey] = useState(Date.now()); // Force re-render du MapContainer
  const markerRef = useRef<L.Marker | null>(null);

  // Mettre à jour le state quand les props changent
  useEffect(() => {
    if (value) {
      setAddress(value.label || '');
      setPosition([value.lat || DEFAULT_LAT, value.lng || DEFAULT_LNG]);
    }
  }, [value]);

  // Géocoder l'adresse saisie
  const handleSearch = async () => {
    if (!address.trim()) return;
    
    setIsSearching(true);
    try {
      // Nominatim API pour la géocodification
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data);
        
        if (data.length > 0) {
          const firstResult = data[0];
          const lat = parseFloat(firstResult.lat);
          const lng = parseFloat(firstResult.lon);
          
          setPosition([lat, lng]);
          updateAddress(firstResult.display_name, lat, lng);
          setMapKey(Date.now()); // Force re-render de la carte
        }
      }
    } catch (error) {
      console.error("Erreur lors de la recherche d'adresse:", error);
    } finally {
      setIsSearching(false);
    }
  };

  // Géocoder inverse pour obtenir l'adresse à partir des coordonnées
  const handleMapClick = async (lat: number, lng: number) => {
    if (!isEditable) return;
    
    setPosition([lat, lng]);
    
    try {
      // Nominatim API pour la géocodification inverse
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data && data.display_name) {
          updateAddress(data.display_name, lat, lng);
        }
      }
    } catch (error) {
      console.error("Erreur lors de la géocodification inverse:", error);
    }
  };

  // Mise à jour de l'adresse et notification du parent
  const updateAddress = (label: string, lat: number, lng: number) => {
    setAddress(label);
    
    if (onChange) {
      onChange({ label, lat, lng });
    }
  };

  // Gestion du changement manuel de l'adresse dans l'input
  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAddress(e.target.value);
  };

  // Gestion du déplacement du marker
  const handleDragEnd = () => {
    if (markerRef.current) {
      const marker = markerRef.current;
      const newPos = marker.getLatLng();
      handleMapClick(newPos.lat, newPos.lng);
    }
  };

  const eventHandlers = {
    dragend: handleDragEnd
  };

  return (
    <div className="address-picker">
      {isEditable ? (
        <>
          <div className="flex items-end mb-2 gap-2">
            <div className="flex-grow">
              <Label htmlFor="address">Adresse</Label>
              <Input
                id="address"
                value={address}
                onChange={handleAddressChange}
                placeholder="Entrez une adresse"
                className="w-full"
                required={required}
              />
            </div>
            <Button 
              onClick={handleSearch} 
              type="button"
              disabled={isSearching}
              className="mb-0"
            >
              <SearchIcon className="h-4 w-4 mr-2" />
              Rechercher
            </Button>
          </div>
          
          {/* Résultats de recherche */}
          {searchResults.length > 0 && (
            <div className="mb-2">
              <select 
                className="w-full p-2 border rounded text-sm"
                onChange={(e) => {
                  const selected = searchResults[parseInt(e.target.value)];
                  if (selected) {
                    const lat = parseFloat(selected.lat);
                    const lng = parseFloat(selected.lon);
                    setPosition([lat, lng]);
                    updateAddress(selected.display_name, lat, lng);
                    setMapKey(Date.now());
                  }
                }}
                defaultValue=""
              >
                <option value="" disabled>Sélectionner une adresse</option>
                {searchResults.map((result, index) => (
                  <option key={index} value={index}>
                    {result.display_name}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          {/* Carte */}
          <div className="mt-3">
            <MapContainer 
              key={mapKey}
              center={position}
              style={{ height: '300px', width: '100%' }} 
              className="rounded border border-gray-300"
              zoom={13}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              <MapEventHandler onMapClick={handleMapClick} />
              <Marker 
                position={position}
                draggable
                eventHandlers={eventHandlers}
                ref={markerRef}
              />
            </MapContainer>

            {position && (
              <div className="mt-2 text-xs text-gray-500">
                Latitude: {position[0].toFixed(6)}, Longitude: {position[1].toFixed(6)}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {value ? (
            <div>
              <p className="text-gray-700 mb-2">{value.label}</p>
              {value.lat && value.lng && (
                <MapContainer
                  center={[value.lat, value.lng]}
                  style={{ height: '200px', width: '100%' }}
                  className="rounded border border-gray-200"
                  zoom={13}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />
                  <Marker position={[value.lat, value.lng]} />
                </MapContainer>
              )}
            </div>
          ) : (
            <p className="text-gray-500 italic">Aucune adresse de livraison</p>
          )}
        </>
      )}
    </div>
  );
};

export default AddressPicker;
