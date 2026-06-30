import React, { useState, useEffect } from "react";
import { CommandeData, CommandeItem } from "@/types";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Package,
  PlusCircle,
  ShoppingCart,
  Eye,
  Pencil,
  Phone, 
  Save,
  Split
} from "lucide-react";
import ImageUpload from "./shared/ImageUpload";
import DetailItemForm from "./shared/DetailItemForm";
import StatusLine from "@/components/ui/StatusLine";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import AddressPicker from "../shared/AddressPicker";
import { formatCFA } from "@/utils/format";
import { getStatusLineState } from "@/utils/status-utils";
import ClientSuggestions from "../shared/ClientSuggestions";
import ProductSuggestions from "../shared/ProductSuggestions";
import CollapsibleSection from "@/components/ui/CollapsibleSection";

interface CommandeTemplateProps {
  data: CommandeData;
  isEditable?: boolean;
  onChange?: (data: CommandeData) => void;
  onSave?: (data: CommandeData) => void;
}

const CommandeTemplate: React.FC<CommandeTemplateProps> = ({
  data: initialData,
  isEditable = false,
  onChange,
  onSave,
}) => {
  const [isEditMode, setIsEditMode] = useState(isEditable);
  const [data, setData] = useState<CommandeData>({
    ...initialData,
    client: initialData.client || { nom: "", adresse: "" },
    items: initialData.items || []
  });
  const { toast } = useToast();
  const isMobile = useIsMobile();

  useEffect(() => {
    setIsEditMode(isEditable);
  }, [isEditable]);

  useEffect(() => {
    setData({
      ...initialData,
      client: initialData.client || { nom: "", adresse: "" },
      items: initialData.items || [],
      dateCommande: initialData.dateCommande?.split("T")[0] || "",
      dateEmission: initialData.dateEmission?.split("T")[0] || "",
      dateLivraison: initialData.dateLivraison?.split("T")[0] || ""
    });
  }, [initialData]);

  // Détecte la note / l'option dans data.details
  const noteValue = data.details?.find(d => 'note' in d)?.note ?? "";
  const optionValue = data.details?.find(d => 'option' in d)?.option ?? "";
  // Récupère le délai de livraison et le montant de l'avance
  const delaiLivraison = data.details?.find(d => 'delaiLivraison' in d)?.delaiLivraison ?? "";
  const montantAvance = data.details?.find(d => 'montantAvance' in d)?.montantAvance ?? 0;

  const handleDataChange = (newData: CommandeData) => {
    setData(newData);
    onChange?.(newData);
  };

  const handleSave = () => {
    setIsEditMode(false);
    onSave?.(data);
    toast({ title: "Commande enregistrée", description: "Modifications enregistrées." });
  };

  const updateClientInfo = (field: string, value: string) => {
    handleDataChange({ ...data, client: { ...data.client, [field]: value } });
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

  // Handle product selection for a command item
  const handleProductSelection = (
    index: number, 
    productInfo: { description: string; prixUnitaire: number; image_url?: string | null }
  ) => {
    const items = [...data.items];
    const current = items[index];
    items[index] = { 
      ...current, 
      nom: productInfo.description,
      prixUnitaire: productInfo.prixUnitaire,
      sous_total: current.quantite * productInfo.prixUnitaire,
      image_url: productInfo.image_url || current.image_url
    };
    
    handleDataChange({ 
      ...data, 
      items, 
      total: items.reduce((s, i) => s + i.sous_total, 0) 
    });
  };

  const addItem = () => {
    const newItem: CommandeItem = { id: crypto.randomUUID(), nom: "", quantite: 1, prixUnitaire: 0, sous_total: 0, image_url: "" };
    const items = [...data.items, newItem];
    handleDataChange({ ...data, items, total: items.reduce((s, i) => s + i.sous_total, 0) });
  };

  const handleItemChange = (
    index: number,
    itemChanges: Partial<CommandeItem> & { description?: string; image_url?: string }
  ) => {
    const items = [...data.items];
    const current = items[index];
    const changes = { nom: itemChanges.description ?? current.nom, ...itemChanges, image_url: itemChanges.image_url ?? current.image_url };
    items[index] = { ...current, ...changes };
    if (changes.quantite !== undefined || changes.prixUnitaire !== undefined) {
      items[index].sous_total = (changes.quantite ?? current.quantite) * (changes.prixUnitaire ?? current.prixUnitaire);
    }
    handleDataChange({ ...data, items, total: items.reduce((s, i) => s + i.sous_total, 0) });
  };

  const removeItem = (index: number) => {
    const items = data.items.filter((_, i) => i !== index);
    handleDataChange({ ...data, items, total: items.reduce((s, i) => s + i.sous_total, 0) });
  };

  // Fractionne un produit : crée un clone avec quantite=1 et réduit l'original de 1
  const fractionateItem = (index: number) => {
    const items = [...data.items];
    const original = items[index];
    if (original.quantite <= 1) return;
    
    // Clone avec quantite=1, nouvelle image vide, nouvel ID
    const clone: CommandeItem = {
      ...original,
      id: crypto.randomUUID(),
      quantite: 1,
      sous_total: original.prixUnitaire,
      image_url: '',
    };
    
    // Réduire l'original de 1
    items[index] = {
      ...original,
      quantite: original.quantite - 1,
      sous_total: (original.quantite - 1) * original.prixUnitaire,
    };
    
    // Insérer le clone juste après l'original
    items.splice(index + 1, 0, clone);
    
    handleDataChange({ ...data, items, total: items.reduce((s, i) => s + i.sous_total, 0) });
  };

  return (
    <div className="w-full py-4 sm:py-6 space-y-6">
      {/* En-tête */}
      <header className="flex justify-between items-center">
        <div className="flex items-center">
          <ShoppingCart className="text-green-600 w-6 h-6 mr-2" />
          <h1 className="text-xl font-bold">N°{data.commandeNumero}</h1>
        </div>

        {!isMobile && isEditable && (
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
        )}
      </header>

      {/* Statut */}
      <section aria-label="Statut">
        {/* Ligne de statut */}
        <StatusLine
          label={data.statut.replace('_', ' ')}
          status={getStatusLineState(data.statut)}
        />

        {/* Sélecteur en mode édition */}
        {isEditMode && (
          <select
            value={data.statut}
            onChange={e =>
              handleDataChange({ ...data, statut: e.target.value })
            }
            className="mt-2 w-full p-2 border rounded text-sm"
          >
            <option value="en_attente">En attente</option>
            <option value="confirmée">Confirmée</option>
            <option value="en_cours">En cours</option>
            <option value="terminée">Terminée</option>
            <option value="annulée">Annulée</option>
          </select>
        )}
      </section>

      {/* Informations client - Utilisation de CollapsibleSection */}
      <CollapsibleSection title="Informations client" defaultOpen={true}>
        {isEditMode && (
          <div className="mb-4">
            <Label>Sélectionner un client existant</Label>
            <ClientSuggestions
              onSelectClient={handleClientSelection}
              currentValue={data.client.nom}
              placeholder="Rechercher un client..."
            />
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Nom</Label>
            {isEditMode ? <Input value={data.client.nom} onChange={e => updateClientInfo('nom', e.target.value)} /> : <p>{data.client.nom}</p>}
          </div>
          <div>
            <Label>Adresse</Label>
            {isEditMode ? <Textarea value={data.client.adresse} onChange={e => updateClientInfo('adresse', e.target.value)} rows={2} /> : <p className="whitespace-pre-line">{data.client.adresse}</p>}
          </div>
          <div>
            <Label>Téléphone</Label>
            {isEditMode ? (
              <Input
                value={data.client.telephone || ''}
                onChange={e => updateClientInfo('telephone', e.target.value)}
              />
            ) : data.client.telephone ? (
              <div className="flex items-center space-x-2">
                {/* Bouton appel */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => window.location.href = `tel:${data.client.telephone}`}
                >
                  <Phone className="w-5 h-5 text-gray-600" />
                </Button>
                <p>📞 {data.client.telephone}</p>
              </div>
            ) : (
              <p>-</p>
            )}
          </div>
        </div>
      </CollapsibleSection>

      {/* Adresse de livraison - Utilisation de CollapsibleSection */}
      <CollapsibleSection title="Adresse de livraison" defaultOpen={true}>
        <AddressPicker
          value={data.deliveryAddress}
          onChange={addr => handleDataChange({ ...data, deliveryAddress: addr })}
          isEditable={isEditMode}
        />
      </CollapsibleSection>

      {/* Détails commande - Utilisation de CollapsibleSection */}
      <CollapsibleSection title="Détails de la commande" defaultOpen={true}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Date de commande</Label>
            {isEditMode ? <Input type="date" value={data.dateCommande} onChange={e => handleDataChange({ ...data, dateCommande: e.target.value })} /> : <p>{new Date(data.dateCommande).toLocaleDateString()}</p>}
          </div>
          {/* Date de livraison */}
          <div>
            <Label>Date de livraison</Label>
            {isEditMode ? (
              <Input
                type="date"
                value={data.dateLivraison || ""}
                onChange={e => handleDataChange({ ...data, dateLivraison: e.target.value })}
              />
            ) : (
              data.dateLivraison
                ? <p>{new Date(data.dateLivraison).toLocaleDateString()}</p>
                : <p className="text-gray-400">–</p>
            )}
          </div>
          <div>
            <Label>Facture liée</Label>
            <p>{data.linked_facture_id ?? '-'}</p>
          </div>
        </div>
        <div className="mt-4">
          <Label>Reçu</Label>
          <ImageUpload imageUrl={data.recu_image_url} onChange={url => handleDataChange({ ...data, recu_image_url: url })} isEditable={isEditMode} />
        </div>
      </CollapsibleSection>

      {/* Conditions de paiement - Utilisation de CollapsibleSection */}
      {data.details?.length ? (
        <CollapsibleSection title="Conditions de paiement" defaultOpen={true}>
          {isEditMode ? (
            <div className="space-y-3">
              <div>
                <Label>Délai de livraison</Label>
                <Input
                  placeholder="ex: 2 semaines"
                  value={delaiLivraison}
                  onChange={e => {
                    handleDataChange({
                      ...data,
                      details: [
                        { note: noteValue },
                        { option: optionValue },
                        { delaiLivraison: e.target.value },
                        { montantAvance },
                      ]
                    });
                  }}
                />
              </div>
              <div>
                <Label>Avance (FCFA)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={montantAvance || ''}
                  onChange={e => {
                    handleDataChange({
                      ...data,
                      details: [
                        { note: noteValue },
                        { option: optionValue },
                        { delaiLivraison },
                        { montantAvance: Number(e.target.value) || 0 },
                      ]
                    });
                  }}
                />
              </div>
              {montantAvance > 0 && (
                <div className="flex justify-between text-sm bg-gray-100 rounded p-2">
                  <span>Reste à payer</span>
                  <span className="font-bold">{formatCFA(data.total - montantAvance)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm border-t pt-2">
                <span>Total</span>
                <span className="font-bold">{formatCFA(data.total)}</span>
              </div>
            </div>
          ) : (
            <ul className="space-y-1">
              {/* 1. Affiche le délai */}
              {delaiLivraison && (
                <li className="flex justify-between">
                  <span>Délai</span>
                  <span>{delaiLivraison}</span>
                </li>
              )}

              {/* 2. Affiche l'avance */}
              {montantAvance !== undefined && (
                <li className="flex justify-between">
                  <span>Avance</span>
                  <span>{formatCFA(montantAvance)}</span>
                </li>
              )}

              {/* 3. Affiche le reste */}
              {montantAvance > 0 && (
                <li className="flex justify-between">
                  <span>Reste</span>
                  <span>{formatCFA(data.total - montantAvance)} FCFA</span>
                </li>
              )}

              {/* 4. Affiche le total */}
              <li className="border-t pt-2 flex justify-between">
                <span>Total</span>
                <span className="font-bold">{formatCFA(data.total)}</span>
              </li>
            </ul>
          )}
        </CollapsibleSection>
      ) : null}

      {/* Important - Utilisation de CollapsibleSection */}
      <CollapsibleSection title="Important" defaultOpen={true}>
        {isEditMode ? (
          <>
            {/* Champ Note */}
            <div className="mb-3">
              <Label>Note</Label>
              <Input
                placeholder="Saisissez une note"
                value={noteValue}
                onChange={e => {
                  handleDataChange({
                    ...data,
                    details: [
                      { note: e.target.value },
                      { option: optionValue },
                      { delaiLivraison },
                      { montantAvance },
                    ]
                  });
                }}
              />
            </div>

            {/* Champ Option */}
            <div>
              <Label>Option</Label>
              <Input
                placeholder="Saisissez une option"
                value={optionValue}
                onChange={e => {
                  handleDataChange({
                    ...data,
                    details: [
                      { note: noteValue },
                      { option: e.target.value },
                      { delaiLivraison },
                      { montantAvance },
                    ]
                  });
                }}
              />
            </div>
          </>
        ) : (
          <ul className="space-y-1">
            {noteValue && <li><strong>Note :</strong> {noteValue}</li>}
            {optionValue && <li><strong>Option :</strong> {optionValue}</li>}
          </ul>
        )}
      </CollapsibleSection>

      {/* Articles - Utilisation de CollapsibleSection */}
      <CollapsibleSection title="Articles" defaultOpen={true}>
        <div className="flex justify-between items-center mb-2">
          {isEditMode && <Button size="sm" onClick={addItem}><PlusCircle className="mr-1" />Ajouter</Button>}
        </div>
        <div className="space-y-4">
          {data.items.map((item, idx) => (
            <div key={item.id} className="relative">
              {isEditMode && (
                <div className="mb-2">
                  <Label>Suggestion de produit</Label>
                  <ProductSuggestions
                    onSelectProduct={(product) => handleProductSelection(idx, product)}
                    currentValue=""
                    placeholder="Rechercher un produit..."
                  />
                </div>
              )}
              <DetailItemForm 
                key={item.id} 
                id={item.id} 
                description={item.nom} 
                quantite={item.quantite} 
                prix={item.prixUnitaire} 
                sousTotal={item.sous_total} 
                image_url={item.image_url} 
                onDelete={() => removeItem(idx)} 
                onChange={ch => handleItemChange(idx, ch)} 
                isEditable={isEditMode} 
                disableAmountEdit={true} 
              />
              {isEditMode && item.quantite > 1 && (
                <div className="mt-1 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fractionateItem(idx)}
                    className="text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
                  >
                    <Split className="h-3 w-3 mr-1" />
                    Fractionner (×{item.quantite})
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* Total */}
      <section className="flex justify-end" aria-label="Total">
        <div className="bg-gray-50 p-4 rounded-lg w-full md:w-64">
          <div className="flex justify-between">
            <span>Total</span>
            <span className="font-bold">{formatCFA(data.total)}</span>
          </div>
        </div>
      </section>
      
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

export default CommandeTemplate;
