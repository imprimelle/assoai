
import React, { useState, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { SearchIcon, MapIcon, MapPinIcon, Maximize2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DeliveryAddress } from '@/types/material';
import { TemplateType } from '@/types/template';
import { useIsMobile } from '@/hooks/use-mobile';
import { formatCFA } from '@/utils/format';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ActionButton } from '@/components/ui/ActionButton';

// Fix the default icon issue
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

// Custom marker icons
const createCustomIcon = (color: string) => {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: ${color};" class="marker-pin"></div>`,
    iconSize: [30, 42],
    iconAnchor: [15, 42]
  });
};

const icons = {
  facture: createCustomIcon('#FF6B6B'),
  devis: createCustomIcon('#4ECDC4'),
  commande: createCustomIcon('#FFD166'),
  cahier_des_charges: createCustomIcon('#9B87F5')
};

// Default icon setup
const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface LocationPoint {
  id: string;
  label: string;
  lat: number;
  lng: number;
  templateType: TemplateType;
  clientName: string;
  documentNumber: string;
  date: string;
  total?: number;
  userId: string;
  userName?: string;
}

// Component to handle map view changes
function MapController({ center, zoom }: { center?: [number, number]; zoom?: number }) {
  const map = useMap();
  
  React.useEffect(() => {
    if (center) {
      map.setView(center, zoom || map.getZoom());
    }
  }, [center, zoom, map]);
  
  return null;
}

const MapView: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([46.227638, 2.213749]); // Center of France
  const [mapZoom, setMapZoom] = useState(5);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  // Fetch location data from messages table
  const { data: locationPoints, isLoading } = useQuery({
    queryKey: ['locationPoints'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('id, template_type, template_data, user_id, session_id')
          .not('template_data', 'is', null)
          .order('timestamp', { ascending: false });

        if (error) throw error;

        if (!data) return [];

        // Extract locations and relevant data from templates
        const points: LocationPoint[] = [];
        
        for (const message of data) {
          if (!message.template_data || !message.template_type) continue;
          
          // Type checking to ensure template_data is an object with data property
          if (typeof message.template_data !== 'object' || message.template_data === null) continue;
          
          // Check if template_data has a data property
          const templateDataObj = message.template_data as { data?: any };
          if (!templateDataObj.data) continue;
          
          const templateData = templateDataObj.data;
          if (!templateData.deliveryAddress) continue;
          
          const address = templateData.deliveryAddress as DeliveryAddress;
          if (!address.lat || !address.lng) continue;
          
          let documentNumber = '';
          let clientName = '';
          let date = '';
          let total = 0;
          
          if (message.template_type === 'facture') {
            documentNumber = templateData.factureNumero || '';
            clientName = templateData.client?.nom || '';
            date = templateData.dateEmission || '';
            total = templateData.total || 0;
          } else if (message.template_type === 'devis') {
            documentNumber = templateData.devisNumero || '';
            clientName = templateData.client?.nom || '';
            date = templateData.dateEmission || '';
            total = templateData.total || 0;
          } else if (message.template_type === 'commande') {
            documentNumber = templateData.commandeNumero || '';
            clientName = templateData.client?.nom || '';
            date = templateData.dateCommande || templateData.dateEmission || '';
            total = templateData.total || 0;
          } else if (message.template_type === 'cahier_des_charges') {
            documentNumber = templateData.titre || '';
            clientName = 'Projet';
            date = '';
          }
          
          points.push({
            id: message.id,
            label: address.label || '',
            lat: address.lat,
            lng: address.lng,
            templateType: message.template_type as TemplateType,
            clientName,
            documentNumber,
            date,
            total,
            userId: message.user_id,
            userName: undefined // Will be populated through a separate query if needed
          });
        }
        
        return points;
      } catch (error) {
        console.error('Error fetching location points:', error);
        toast({
          title: 'Erreur',
          description: 'Impossible de charger les données de localisation',
          variant: 'destructive'
        });
        return [];
      }
    }
  });

  // Filter points based on search query and selected type
  const filteredPoints = useMemo(() => {
    if (!locationPoints) return [];
    
    return locationPoints.filter(point => {
      const matchesSearch = searchQuery === '' || 
        point.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        point.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        point.documentNumber.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesType = selectedType === null || point.templateType === selectedType;
      
      return matchesSearch && matchesType;
    });
  }, [locationPoints, searchQuery, selectedType]);

  // Focus on a specific point
  const handleFocusPoint = useCallback((point: LocationPoint) => {
    setMapCenter([point.lat, point.lng]);
    setMapZoom(16);
  }, []);

  // Format number as currency - replaced with formatCFA
  const formatCurrency = (value?: number) => {
    if (value === undefined) return '';
    return formatCFA(value);
  };

  // Template type display names
  const templateTypeNames: Record<string, string> = {
    facture: 'Facture',
    devis: 'Devis',
    commande: 'Commande',
    cahier_des_charges: 'Cahier des charges'
  };

  // Get template type badge color
  const getTemplateTypeColor = (type: TemplateType): string => {
    switch (type) {
      case 'facture': return 'bg-[#FF6B6B] text-white';
      case 'devis': return 'bg-[#4ECDC4] text-white';
      case 'commande': return 'bg-[#FFD166] text-black';
      case 'cahier_des_charges': return 'bg-[#9B87F5] text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  // Map rendering component to reuse in both normal and fullscreen views
  const renderMap = () => (
    <MapContainer
      center={mapCenter}
      zoom={mapZoom}
      style={{ height: '100%', width: '100%' }}
      className="z-0"
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <MapController center={mapCenter} zoom={mapZoom} />
      
      {filteredPoints.map((point) => (
        <Marker
          key={point.id}
          position={[point.lat, point.lng]}
          icon={icons[point.templateType] || DefaultIcon}
        >
          <Popup>
            <div className="min-w-[200px]">
              <div className="font-bold">{point.clientName}</div>
              <div className="text-sm">{point.documentNumber}</div>
              <div className="text-sm text-gray-600">{point.label}</div>
              {point.date && <div className="text-sm">Date: {point.date}</div>}
              {point.total !== undefined && <div className="text-sm">Montant: {formatCurrency(point.total)}</div>}
              <Badge className={`mt-2 ${getTemplateTypeColor(point.templateType)}`}>
                {templateTypeNames[point.templateType]}
              </Badge>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );

  // Location list rendering component to reuse
  const renderLocationList = () => (
    <>
      <h3 className="font-medium mb-2 flex items-center">
        <MapPinIcon className="h-4 w-4 mr-1" />
        Emplacements ({filteredPoints.length})
      </h3>
      <div className="space-y-2">
        {filteredPoints.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Aucun emplacement trouvé
          </div>
        ) : (
          filteredPoints.map((point) => (
            <div
              key={point.id}
              className="p-3 border rounded-md hover:bg-gray-50 cursor-pointer flex justify-between"
              onClick={() => handleFocusPoint(point)}
            >
              <div>
                <div className="font-medium">{point.clientName}</div>
                <div className="text-sm text-gray-600 truncate max-w-[230px]">
                  {point.label}
                </div>
                <div className="text-sm">
                  <Badge className={`mt-1 ${getTemplateTypeColor(point.templateType)}`}>
                    {templateTypeNames[point.templateType]}
                  </Badge>
                  {point.documentNumber && 
                    <span className="ml-2 text-xs text-gray-500">
                      {point.documentNumber}
                    </span>
                  }
                </div>
              </div>
              {point.total !== undefined && (
                <div className="text-right">
                  <div className="font-medium">{formatCurrency(point.total)}</div>
                  {point.date && <div className="text-xs text-gray-500">{point.date}</div>}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </>
  );

  // Search and filter controls rendering component to reuse
  const renderSearchAndFilters = () => (
    <>
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
        <div>
          <CardTitle className="text-xl flex items-center gap-2">
            <MapIcon className="h-5 w-5" />
            Carte des Emplacements
          </CardTitle>
          <CardDescription>
            Visualisation des adresses de livraison des documents
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          {['facture', 'devis', 'commande', 'cahier_des_charges'].map(type => (
            <Button
              key={type}
              variant={selectedType === type ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedType(selectedType === type ? null : type)}
              className="px-3"
            >
              {templateTypeNames[type]}
            </Button>
          ))}
          {selectedType && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedType(null)}
              className="px-2"
            >
              Tout afficher
            </Button>
          )}
        </div>
      </div>
      <div className="flex w-full max-w-md items-center space-x-2 mt-4">
        <Input
          type="search"
          placeholder="Rechercher par adresse, client ou numéro..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full"
        />
        <Button type="submit" size="icon">
          <SearchIcon className="h-4 w-4" />
        </Button>
      </div>
    </>
  );

  return (
    <>
      <Card className="w-full shadow-md">
        <CardHeader>
          {renderSearchAndFilters()}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className={`${isMobile ? "order-2" : ""} lg:col-span-3`}>
              <div className="h-[400px] md:h-[500px] relative rounded-lg overflow-hidden border">
                {isLoading ? (
                  <div className="flex items-center justify-center h-full bg-gray-100">
                    <div className="text-center">
                      <p className="text-gray-500">Chargement de la carte...</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {renderMap()}
                    <div className="absolute top-2 right-2 z-10">
                      <ActionButton 
                        icon={Maximize2} 
                        label="Plein écran" 
                        onClick={() => setIsFullScreen(true)}
                        variant="blue"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className={`${isMobile ? "order-1" : ""} lg:col-span-2 max-h-[300px] lg:max-h-[500px] overflow-y-auto pr-2`}>
              {renderLocationList()}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal de carte en plein écran */}
      <Dialog open={isFullScreen} onOpenChange={setIsFullScreen}>
        <DialogContent className="sm:max-w-[95vw] sm:max-h-[95vh] h-[95vh] w-[95vw] p-0">
          <div className="flex flex-col h-full">
            <div className="p-4 border-b">
              {renderSearchAndFilters()}
              <Button 
                variant="ghost"
                size="icon"
                onClick={() => setIsFullScreen(false)}
                className="absolute right-4 top-4"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="flex-1 p-4 overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 h-full">
                <div className="md:col-span-3 h-full relative rounded-lg overflow-hidden border">
                  {renderMap()}
                </div>
                <div className="md:col-span-1 h-full max-h-full overflow-y-auto pr-2">
                  {renderLocationList()}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MapView;
