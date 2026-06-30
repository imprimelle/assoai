import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FactureData, DetailItem } from "@/types";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { 
  Receipt, 
  Pencil, 
  Eye, 
  Save, 
  PlusCircle, 
  Trash2 
} from "lucide-react";
import DetailItemForm from "./shared/DetailItemForm";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import ClientSuggestions from "../shared/ClientSuggestions";
import ProductSuggestions from "../shared/ProductSuggestions";
import CollapsibleSection from "../ui/CollapsibleSection";
import StatusLine from "@/components/ui/StatusLine";
import { formatCFA } from "@/utils/format";
import { getStatusLineState } from "@/utils/status-utils";

interface FactureTemplateProps {
  data: FactureData;
  onSave?: (data: FactureData) => void;
  isEditable?: boolean;
  onChange?: (data: FactureData) => void;
}

const FactureTemplate: React.FC<FactureTemplateProps> = ({
  data: initialData,
  onSave,
  isEditable = false,
  onChange,
}) => {
  const [isEditMode, setIsEditMode] = useState(isEditable);
  const [data, setData] = useState<FactureData>({
    ...initialData,
    details: initialData.details || [],
    client: initialData.client || { nom: "", adresse: "" }
  });
  const { toast } = useToast();
  const isMobile = useIsMobile();

  useEffect(() => {
    setIsEditMode(isEditable);
  }, [isEditable]);

  useEffect(() => {
    const normalizedData = {
      ...initialData,
      details: initialData.details || [],
      client: initialData.client || { nom: "", adresse: "" },
      dateEmission: initialData.dateEmission?.split("T")[0] || ""
    };
    setData(normalizedData);
  }, [initialData]);

  const handleDataChange = (newData: FactureData) => {
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
      title: "Facture enregistrée",
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

  // Handle client selection from suggestions
  const handleClientSelection = (client: { nom: string; adresse: string; telephone?: string }) => {
    handleDataChange({
      ...data,
      client: {
        nom: client.nom,
        adresse: client.adresse,
        telephone: client.telephone
      }
    });
  };

  // Handle product selection for a detail item
  const handleProductSelection = (index: number, productInfo: { description: string; prixUnitaire: number; image_url?: string | null }) => {
    const current = data.details[index];
    const updated = { 
      ...current, 
      description: productInfo.description,
      prixUnitaire: productInfo.prixUnitaire,
      sous_total: current.quantite * productInfo.prixUnitaire
    };

    const newDetails = [...data.details];
    newDetails[index] = updated;

    // Total après application de la remise stockée en €
    const base = newDetails.reduce((sum, item) => sum + item.sous_total, 0);
    const newTotal = base - (data.reduction ?? 0);

    handleDataChange({
      ...data,
      details: newDetails,
      total: newTotal
    });
  };

  // Montant brut avant remise - guard against undefined details
  const baseTotal = data.details?.reduce((sum, item) => sum + item.sous_total, 0) || 0;

  // Nouveau (state + syncing)
  const [currentPercent, setCurrentPercent] = useState<number>(
    baseTotal > 0
      ? Math.round(((data.reduction ?? 0) / baseTotal) * 100)
      : 0
  );

  // Dès que data.reduction ou baseTotal change, on recalcule automatiquement le pourcentage
  useEffect(() => {
    const pct = baseTotal > 0
      ? Math.round(((data.reduction ?? 0) / baseTotal) * 100)
      : 0;
    setCurrentPercent(pct);
  }, [data.reduction, baseTotal]);

  const updateDetailItem = (index: number, changes: Partial<DetailItem>) => {
    if (!data.details) {
      return; // Guard against undefined details
    }
    
    const current = data.details[index];
    const updated = { ...current, ...changes };
    updated.sous_total = Number(updated.quantite) * Number(updated.prixUnitaire);

    const newDetails = [...data.details];
    newDetails[index] = updated;

    // Total après application de la remise stockée en €
    const base = newDetails.reduce((sum, item) => sum + item.sous_total, 0);
    const newTotal = base - (data.reduction ?? 0);

    handleDataChange({
      ...data,
      details: newDetails,
      total: newTotal
    });
  };

  const addNewDetail = () => {
    const newDetail: DetailItem = {
      id: crypto.randomUUID(),
      description: "",
      quantite: 1,
      prixUnitaire: 0,
      sous_total: 0
    };
    
    const newDetails = [newDetail, ...(data.details || [])];

    handleDataChange({
      ...data,
      details: newDetails
    });
  };

  const removeDetail = (index: number) => {
    if (!data.details) {
      return; // Guard against undefined details
    }
    
    const newDetails = data.details.filter((_, i) => i !== index);
    const newTotal = newDetails.reduce((sum, item) => sum + (item.quantite * item.prixUnitaire), 0);
    
    const newData = {
      ...data,
      details: newDetails,
      total: newTotal
    };
    
    handleDataChange(newData);
  };

  return (
    <div className="w-full py-4 sm:py-6">
      <div className="flex justify-between items-center mb-4 sm:mb-6">
        <div className="flex items-center">
          <div className="bg-orange-100 p-2 rounded-full mr-3">
            <Receipt className="h-6 w-6 text-orange-600" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800">FACTURE</h1>
            <p className="font-medium mt-1 text-md text-gray-600">
              N° {data.factureNumero}
            </p>
          </div>
        </div>
        
        {!isMobile && isEditable && (
          <div className="flex space-x-2 items-center">
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
        )}
      </div>
      
      {/* Statut */}
      <section aria-label="Statut" className="mb-4">
        <StatusLine
          label={data.statut ?? "Brouillon"}
          status={getStatusLineState(data.statut ?? "Brouillon")}
        />
        {isEditMode && (
          <select
            value={data.statut}
            onChange={(e) =>
              handleDataChange({ ...data, statut: e.target.value as any })
            }
            className="mt-2 w-full p-2 border rounded text-sm"
          >
            <option value="Brouillon">Brouillon</option>
            <option value="vérification">Vérification</option>
            <option value="Vérifié">Vérifié</option>
            <option value="validé">Validé</option>
          </select>
        )}
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Informations client - Now Collapsible */}
        <CollapsibleSection title="Informations client" defaultOpen={true} className="bg-gray-50 rounded-lg">
          <div className="space-y-2">
            {/* Client Suggestions */}
            {isEditMode ? (
              <div className="space-y-2">
                <Label htmlFor="clientSuggestion">Sélectionner un client existant</Label>
                <ClientSuggestions
                  onSelectClient={handleClientSelection}
                  currentValue={data.client.nom}
                  placeholder="Rechercher un client..."
                />
              </div>
            ) : null}
            
            <div>
              <Label htmlFor="clientNom">Nom du client</Label>
              {isEditMode ? (
                <Input
                  id="clientNom"
                  value={data.client.nom}
                  onChange={(e) => updateClientInfo("nom", e.target.value)}
                  className="h-10"
                />
              ) : (
                <p className="text-gray-800 mt-1">{data.client.nom}</p>
              )}
            </div>
            <div>
              <Label htmlFor="clientAdresse">Adresse</Label>
              {isEditMode ? (
                <Textarea
                  id="clientAdresse"
                  value={data.client.adresse}
                  onChange={(e) => updateClientInfo("adresse", e.target.value)}
                  rows={3}
                  className="min-h-[60px]"
                />
              ) : (
                <p className="text-gray-800 whitespace-pre-line mt-1">{data.client.adresse}</p>
              )}
            </div>
            {/* Téléphone du client */}
            <div>
              <Label htmlFor="clientTelephone">Téléphone</Label>
              {isEditMode ? (
                <Input
                  id="clientTelephone"
                  value={data.client.telephone || ""}
                  onChange={(e) => updateClientInfo("telephone", e.target.value)}
                  className="h-10"
                />
              ) : (
                data.client.telephone && (
                  <p className="text-gray-800 mt-1">📞 {data.client.telephone}</p>
                )
              )}
            </div>
          </div>
        </CollapsibleSection>

        {/* Détails de la facture - Now Collapsible */}
        <CollapsibleSection title="Détails de la facture" defaultOpen={true} className="bg-gray-50 rounded-lg">
          <div className="space-y-2">
            <div>
              <Label htmlFor="dateEmission">Date d'émission</Label>
              {isEditMode ? (
                <Input
                  id="dateEmission"
                  type="date"
                  value={data.dateEmission?.split("T")[0] || ""}
                  onChange={(e) => handleDataChange({...data, dateEmission: e.target.value})}
                  className="h-10"
                />
              ) : (
                <p className="text-gray-800 mt-1">{new Date(data.dateEmission).toLocaleDateString()}</p>
              )}
            </div>
            
            {/* Échéancier */}
            <div>
              <Label htmlFor="echeancier">Échéancier</Label>
              {isEditMode ? (
                <Input
                  id="echeancier"
                  value={data.echeancier || ""}
                  onChange={e=>handleDataChange({ ...data, echeancier: e.target.value })}
                />
              ) : (
                data.echeancier && <p>{data.echeancier}</p>
              )}
            </div>

            {data.delaiLivraison && (
              <div>
                <Label htmlFor="delaiLivraison">Délai de livraison</Label>
                {isEditMode ? (
                  <Input
                    id="delaiLivraison"
                    type="text"
                    value={data.delaiLivraison}
                    onChange={(e) => handleDataChange({...data, delaiLivraison: e.target.value})}
                    className="h-10"
                  />
                ) : (
                  <p className="text-gray-800 mt-1">{data.delaiLivraison}</p>
                )}
              </div>
            )}
          </div>
        </CollapsibleSection>
      </div>

      {/* Détails - Now Collapsible */}
      <CollapsibleSection title="Articles" defaultOpen={true} className="mb-6">
        <div className="flex justify-end items-center mb-4">
          {isEditMode && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={addNewDetail}
              className="flex items-center"
            >
              <PlusCircle className="h-4 w-4 mr-1" /> Ajouter un article
            </Button>
          )}
        </div>

        <div className="space-y-4">
          {data.details && data.details.map((item, index) => (
            <div key={item.id} className="relative">
              {isEditMode && (
                <div className="mb-2">
                  <Label htmlFor={`product-suggestion-${index}`}>Suggestion de produit</Label>
                  <ProductSuggestions
                    onSelectProduct={(product) => handleProductSelection(index, product)}
                    currentValue=""
                    placeholder="Rechercher un produit..."
                  />
                </div>
              )}
              <DetailItemForm
                id={item.id}
                description={item.description}
                quantite={item.quantite}
                prix={item.prixUnitaire}
                sousTotal={item.sous_total}
                onDelete={() => removeDetail(index)}
                onChange={(changes) => updateDetailItem(index, changes)}
                isEditable={isEditMode}
              />
            </div>
          ))}
        </div>

        {/* Bloc de remise (€ + % & slider) */}
        <div className="mt-6 mb-4 sm:mb-6 p-4 bg-gray-50 rounded-lg w-full sm:w-64">
          {isEditMode ? (
            <>
              <div className="flex justify-between items-center text-sm mb-1">
                <span>Remise</span>
                <div className="flex items-center space-x-2">
                  {/* Montant (€) */}
                  <input
                    type="number"
                    min={0}
                    max={baseTotal}
                    value={data.reduction ?? 0}
                    onChange={e => {
                      const newReduction = Number(e.currentTarget.value) || 0;
                      const pct = baseTotal > 0
                        ? Math.round((newReduction * 100) / baseTotal)
                        : 0;
                      const newTotal = baseTotal - newReduction;
                      setCurrentPercent(pct);
                      handleDataChange({ ...data, reduction: newReduction, total: newTotal });
                    }}
                    className="w-20 px-1 py-0.5 border rounded text-right"
                    aria-label="Montant de la remise en euros"
                  />
                  <span>CFA</span>

                  {/* Pourcentage (%) */}
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={currentPercent}
                    onChange={e => {
                      const pct = Number(e.currentTarget.value) || 0;
                      const newReduction = Math.round((baseTotal * pct) / 100);
                      const newTotal = baseTotal - newReduction;
                      setCurrentPercent(pct);
                      handleDataChange({ ...data, reduction: newReduction, total: newTotal });
                    }}
                    className="w-16 px-1 py-0.5 border rounded text-right"
                    aria-label="Pourcentage de remise"
                  />
                  <span>%</span>
                </div>
              </div>

              {/* Slider */}
              <input
                type="range"
                min={0}
                max={100}
                value={currentPercent}
                onChange={e => {
                  const pct = Number(e.currentTarget.value);
                  const newReduction = Math.round((baseTotal * pct) / 100);
                  const newTotal = baseTotal - newReduction;
                  setCurrentPercent(pct);
                  handleDataChange({ ...data, reduction: newReduction, total: newTotal });
                }}
                className="w-full h-2 bg-gray-200 rounded-lg"
                aria-label="Slider de remise"
              />
            </>
          ) : (
            <div className="flex justify-between items-center text-sm">
              <span>Remise</span>
              <span className="font-medium">
                {formatCFA(data.reduction ?? 0)} ({currentPercent}%)
              </span>
            </div>
          )}
        </div>

        <div className="mt-4 sm:mt-6 flex justify-end">
          <div className="bg-gray-50 p-3 sm:p-4 rounded-lg w-full sm:w-64">
            <div className="flex justify-between mb-1 sm:mb-2">
              <span className="font-medium">Total</span>
              <span className="font-bold">{formatCFA(data.total)}</span>
            </div>
          </div>
        </div>
      </CollapsibleSection>
      
      {/* Barre d'actions mobile */}
      {isMobile && isEditable && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-2 flex justify-between items-center z-10">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setIsEditMode(!isEditMode)}
            className="flex-1"
          >
            {isEditMode ? <><Eye size={16} className="mr-1" /> Aperçu</> : <><Pencil size={16} className="mr-1" /> Modifier</>}
          </Button>
          
          {isEditMode && (
            <Button 
              variant="default" 
              size="sm" 
              onClick={handleSave}
              className="flex-1 ml-2"
            >
              <Save size={16} className="mr-1" /> Enregistrer
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default FactureTemplate;
