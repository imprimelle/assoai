import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DevisData, DetailItem } from "@/types";
import { format, addDays } from "date-fns";
import { fr } from "date-fns/locale";
import { Pencil, Eye, Save, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatCFA } from "@/utils/format";
import StatusLine from "@/components/ui/StatusLine";
import { getStatusLineState } from "@/utils/status-utils";
import CollapsibleSection from "@/components/ui/CollapsibleSection";

// Define the valid statuses for a Devis
type DevisStatus = "Brouillon" | "En attente" | "Accepté" | "Refusé" | "Expiré";

interface DevisTemplateProps {
  data: DevisData;
  onSave?: (data: DevisData) => void;
  isEditable?: boolean;
  onChange?: (data: DevisData) => void;
}

const DevisTemplate: React.FC<DevisTemplateProps> = ({ 
  data: initialData, 
  onSave,
  isEditable = false,
  onChange
}) => {
  const [isEditMode, setIsEditMode] = useState(isEditable);
  const [data, setData] = useState<DevisData>({
    ...initialData,
    client: initialData.client || { nom: "", adresse: "" },
    details: initialData.details || []
  });
  const { toast } = useToast();
  const isMobile = useIsMobile();

  // Mettre à jour isEditMode si isEditable change
  useEffect(() => {
    setIsEditMode(isEditable);
  }, [isEditable]);

  // Mettre à jour les données si initialData change
  useEffect(() => {
    setData({
      ...initialData,
      client: initialData.client || { nom: "", adresse: "" },
      details: initialData.details || []
    });
  }, [initialData]);

  const handleDataChange = (newData: DevisData) => {
    setData(newData);
    if (onChange) {
      onChange(newData);
    }
  };

  const handleSave = () => {
    setIsEditMode(false);
    if (onSave) {
      onSave(data);
    }
    toast({
      title: "Devis enregistré",
      description: "Les modifications ont été enregistrées avec succès.",
    });
  };

  const updateClientInfo = (field: string, value: string) => {
    const newData = {
      ...data,
      client: {
        ...data.client,
        [field]: value
      }
    };
    handleDataChange(newData);
  };

  const updateItemField = (index: number, field: string, value: any) => {
    const newDetails = [...data.details];
    newDetails[index] = {
      ...newDetails[index],
      [field]: field === 'quantite' || field === 'prixUnitaire' ? Number(value) : value
    };
    
    // Recalculer le total
    const newTotal = newDetails.reduce((sum, item) => sum + (item.quantite * item.prixUnitaire), 0);
    
    const newData = {
      ...data,
      details: newDetails,
      total: newTotal
    };
    
    handleDataChange(newData);
  };

  const addNewItem = () => {
    const newData = {
      ...data,
      details: [...data.details, { 
        id: crypto.randomUUID(), 
        description: "", 
        quantite: 1, 
        prixUnitaire: 0,
        sous_total: 0 // Ajout de cette propriété manquante
      }]
    };
    handleDataChange(newData);
  };

  const removeItem = (index: number) => {
    const newDetails = data.details.filter((_, i) => i !== index);
    const newTotal = newDetails.reduce((sum, item) => sum + (item.quantite * item.prixUnitaire), 0);
    
    const newData = {
      ...data,
      details: newDetails,
      total: newTotal
    };
    
    handleDataChange(newData);
  };

  const calculateValidUntil = () => {
    const emissionDate = new Date(data.dateEmission);
    const validUntil = addDays(emissionDate, data.validiteJours);
    return format(validUntil, 'dd MMMM yyyy', { locale: fr });
  };

  return (
    <div className="w-full py-4 sm:py-6">
      <div className="flex justify-between items-center mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-brand-dark">DEVIS</h1>
        
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setIsEditMode(!isEditMode)}
          >
            {isEditMode ? <><Eye size={16} className="mr-1" /> Aperçu</> : <><Pencil size={16} className="mr-1" /> Modifier</>}
          </Button>
          {isEditMode && (
            <Button 
              variant="default" 
              size="sm" 
              onClick={handleSave}
            >
              <Save size={16} className="mr-1" /> Enregistrer
            </Button>
          )}
        </div>
      </div>

      {/* Section Statut */}
      <CollapsibleSection title="Statut" defaultOpen={true}>
        <StatusLine
          label={data.statut ?? "Brouillon"}
          status={getStatusLineState(data.statut ?? "Brouillon")}
        />
        {isEditMode && (
          <select
            value={data.statut || "Brouillon"}
            onChange={(e) =>
              handleDataChange({ ...data, statut: e.target.value as DevisStatus })
            }
            className="mt-2 w-full p-2 border rounded text-sm"
          >
            <option value="Brouillon">Brouillon</option>
            <option value="En attente">En attente</option>
            <option value="Accepté">Accepté</option>
            <option value="Refusé">Refusé</option>
            <option value="Expiré">Expiré</option>
          </select>
        )}
      </CollapsibleSection>

      {/* Nouvelle section Informations générales */}
      <CollapsibleSection title="Informations générales" defaultOpen={true}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <Label className="text-sm text-gray-500 mb-1 block">ID Commande</Label>
            <Input 
              value={data.devisNumero} 
              readOnly
              className="bg-gray-100 h-11 sm:h-10 text-base"
            />
          </div>
          <div>
            <Label className="text-sm text-gray-500 mb-1 block">CDC ID</Label>
            {isEditMode ? (
              <Input 
                value={data.cdc_id || ""} 
                onChange={(e) => handleDataChange({ ...data, cdc_id: e.target.value })}
                placeholder="ID du cahier des charges"
                className="h-11 sm:h-10 text-base"
              />
            ) : (
              <Input 
                value={data.cdc_id || "Non spécifié"} 
                readOnly
                className="bg-gray-100 h-11 sm:h-10 text-base"
              />
            )}
          </div>
        </div>
        
        <div className="mb-4">
          <Label className="text-sm text-gray-500 mb-1 block">Type de structure</Label>
          {isEditMode ? (
            <Input 
              value={data.type_structure || ""} 
              onChange={(e) => handleDataChange({ ...data, type_structure: e.target.value })}
              placeholder="Ex: Stand, Kakémono, Panneau..."
              className="h-11 sm:h-10 text-base"
            />
          ) : (
            <Input 
              value={data.type_structure || "Non spécifié"} 
              readOnly
              className="bg-gray-100 h-11 sm:h-10 text-base"
            />
          )}
        </div>
        
        <div>
          <Label className="text-sm text-gray-500 mb-1 block">Méthode de fabrication</Label>
          {isEditMode ? (
            <Textarea 
              value={data.method_fabrication || ""} 
              onChange={(e) => handleDataChange({ ...data, method_fabrication: e.target.value })}
              placeholder="Décrivez la méthode de fabrication..."
              className="min-h-[80px] text-base"
            />
          ) : (
            <Textarea 
              value={data.method_fabrication || "Non spécifiée"} 
              readOnly
              className="bg-gray-100 min-h-[80px] text-base"
            />
          )}
        </div>
      </CollapsibleSection>

      {/* Section Détails du devis (anciennement Informations générales) */}
      <CollapsibleSection title="Détails du devis" defaultOpen={true}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          <div>
            <p className="text-sm text-gray-500 mb-1">Devis N°</p>
            {isEditMode ? (
              <Input 
                value={data.devisNumero} 
                onChange={(e) => setData(prev => ({ ...prev, devisNumero: e.target.value }))}
                className="h-11 sm:h-10 text-base"
              />
            ) : (
              <p className="font-semibold">{data.devisNumero}</p>
            )}
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">Date d'émission</p>
            {isEditMode ? (
              <Input 
                type="date" 
                value={data.dateEmission} 
                onChange={(e) => setData(prev => ({ ...prev, dateEmission: e.target.value }))}
                className="h-11 sm:h-10 text-base"
              />
            ) : (
              <p className="font-semibold">
                {format(new Date(data.dateEmission), 'dd MMMM yyyy', { locale: fr })}
              </p>
            )}
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">Validité (jours)</p>
            {isEditMode ? (
              <Input 
                type="number"
                min="1"
                value={data.validiteJours} 
                onChange={(e) => setData(prev => ({ ...prev, validiteJours: Number(e.target.value) }))}
                className="h-11 sm:h-10 text-base"
              />
            ) : (
              <p className="font-semibold">Valable jusqu'au {calculateValidUntil()}</p>
            )}
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Informations client" defaultOpen={true}>
        <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
          {isEditMode ? (
            <div className="space-y-3">
              <div>
                <Label htmlFor="clientName" className="mb-1 block">Nom</Label>
                <Input 
                  id="clientName"
                  value={data.client.nom} 
                  onChange={(e) => updateClientInfo('nom', e.target.value)}
                  className="h-11 sm:h-10 text-base"
                />
              </div>
              <div>
                <Label htmlFor="clientAddress" className="mb-1 block">Adresse</Label>
                <Input 
                  id="clientAddress"
                  value={data.client.adresse} 
                  onChange={(e) => updateClientInfo('adresse', e.target.value)}
                  className="h-11 sm:h-10 text-base"
                />
              </div>
            </div>
          ) : (
            <>
              <p className="font-semibold">{data.client.nom}</p>
              <p className="text-gray-600">{data.client.adresse}</p>
            </>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Détails" defaultOpen={true}>
        <div className="overflow-x-auto -mx-2 px-2">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th scope="col" className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Qté
                </th>
                <th scope="col" className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prix unit.
                </th>
                <th scope="col" className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                {isEditMode && (
                  <th scope="col" className="px-2 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.details.map((item, index) => (
                <tr key={index}>
                  <td className="px-2 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                    {isEditMode ? (
                      <Input 
                        value={item.description} 
                        onChange={(e) => updateItemField(index, 'description', e.target.value)}
                        className="h-11 sm:h-10 text-base w-full min-w-[120px]"
                      />
                    ) : (
                      <div className="text-sm text-gray-900">{item.description}</div>
                    )}
                  </td>
                  <td className="px-2 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                    {isEditMode ? (
                      <Input 
                        type="number" 
                        min="1"
                        value={item.quantite} 
                        onChange={(e) => updateItemField(index, 'quantite', e.target.value)}
                        className="h-11 sm:h-10 text-base w-16 sm:w-20"
                      />
                    ) : (
                      <div className="text-sm text-gray-900">{item.quantite}</div>
                    )}
                  </td>
                  <td className="px-2 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                    {isEditMode ? (
                      <Input 
                        type="number" 
                        min="0"
                        value={item.prixUnitaire} 
                        onChange={(e) => updateItemField(index, 'prixUnitaire', e.target.value)}
                        className="h-11 sm:h-10 text-base w-20 sm:w-28"
                      />
                    ) : (
                      <div className="text-sm text-gray-900">{formatCFA(item.prixUnitaire)}</div>
                    )}
                  </td>
                  <td className="px-2 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCFA(item.quantite * item.prixUnitaire)}
                  </td>
                  {isEditMode && (
                    <td className="px-2 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => removeItem(index)}
                        className="text-red-600 hover:text-red-800 h-9 w-9 p-0"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {isEditMode && (
          <div className="mt-3 sm:mt-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={addNewItem}
              className="text-brand-orange h-11 sm:h-10"
            >
              <Plus size={16} className="mr-1" /> Ajouter un élément
            </Button>
          </div>
        )}
        
        <div className="mt-4 sm:mt-6 flex justify-end">
          <div className="bg-gray-50 p-3 sm:p-4 rounded-lg w-full sm:w-64">
            <div className="flex justify-between mb-1 sm:mb-2">
              <span className="font-medium">Total</span>
              <span className="font-bold">{formatCFA(data.total)}</span>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      <div className="text-sm text-gray-500 italic">
        Ce devis est valable {data.validiteJours} jours à compter de la date d'émission.
      </div>
    </div>
  );
};

export default DevisTemplate;
