import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FactureData, CommandeData, DetailItem } from "@/types";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { 
  Receipt, 
  ShoppingCart,
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
import CollapsibleSection from "../ui/CollapsibleSection";
import StatusLine from "@/components/ui/StatusLine";
import { formatCFA } from "@/utils/format";
import { getStatusLineState } from "@/utils/status-utils";
import type { BuilderMode } from "@/pages/FactureBuilder";

interface FactureTemplateProps {
  data: FactureData | CommandeData;
  onSave?: (data: FactureData | CommandeData) => void;
  isEditable?: boolean;
  onChange?: (data: FactureData | CommandeData) => void;
  /** Masque le header interne (titre FACTURE + boutons) — utilisé quand le header est géré par la page parent */
  hideHeader?: boolean;
  /** Masque la barre d'actions mobile fixe — utilisé quand le footer est géré par la page parent */
  hideMobileBar?: boolean;
  /** Masque les blocs d'infos (statut, client, détails, remise) — utilisé avec FactureBuilderHeader */
  hideInfoBlocks?: boolean;
  /** Force l'ouverture/fermeture de la section Articles (toggle externe) */
  articlesOpen?: boolean;
  /** Mode : facture ou commande */
  mode?: BuilderMode;
}

const FactureTemplate: React.FC<FactureTemplateProps> = ({
  data: initialData,
  onSave,
  isEditable = false,
  onChange,
  hideHeader = false,
  hideMobileBar = false,
  hideInfoBlocks = false,
  articlesOpen,
  mode = "facture",
}) => {
  const isCommande = mode === "commande";
  const [isEditMode, setIsEditMode] = useState(isEditable);
  const [data, setData] = useState<FactureData | CommandeData>({
    ...initialData,
    details: (initialData as FactureData).details || [],
    items: (initialData as CommandeData).items || [],
    client: initialData.client || { nom: "", adresse: "" }
  });
  const { toast } = useToast();
  const isMobile = useIsMobile();

  useEffect(() => {
    setIsEditMode(isEditable);
  }, [isEditable]);

  useEffect(() => {
    const normalizedData: FactureData | CommandeData = {
      ...initialData,
      client: initialData.client || { nom: "", adresse: "" },
    };
    if (isCommande) {
      (normalizedData as CommandeData).items = (initialData as CommandeData).items || [];
      (normalizedData as CommandeData).dateCommande = (initialData as CommandeData).dateCommande?.split("T")[0] || "";
    } else {
      (normalizedData as FactureData).details = (initialData as FactureData).details || [];
      (normalizedData as FactureData).dateEmission = (initialData as FactureData).dateEmission?.split("T")[0] || "";
    }
    setData(normalizedData);
  }, [initialData, isCommande]);

  const handleDataChange = (newData: FactureData | CommandeData) => {
    setData(newData);
    if (onChange) {
      onChange(newData);
    }
  };

  // Helpers: obtenir/remplacer les articles selon le mode
  const getItems = (d: FactureData | CommandeData): any[] =>
    isCommande ? ((d as CommandeData).items || []) : ((d as FactureData).details || []);

  const setItems = (d: FactureData | CommandeData, items: any[]): FactureData | CommandeData =>
    isCommande ? { ...d, items } : { ...d, details: items };

  // Montant brut avant remise
  const baseTotal = getItems(data).reduce((sum: number, item: any) => sum + (item.sous_total ?? 0), 0);

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
    const reduction = (data as any).reduction ?? 0;
    const pct = baseTotal > 0
      ? Math.round((reduction / baseTotal) * 100)
      : 0;
    setCurrentPercent(pct);
  }, [(data as any).reduction, baseTotal]);

  const updateDetailItem = (index: number, changes: Partial<DetailItem>) => {
    const items = getItems(data);
    if (!items || index >= items.length) return;

    const current = items[index];
    const updated = { ...current, ...changes };
    updated.sous_total = Number(updated.quantite) * Number(updated.prixUnitaire);

    const newItems = [...items];
    newItems[index] = updated;

    const base = newItems.reduce((sum: number, item: any) => sum + (item.sous_total ?? 0), 0);
    const newTotal = base - ((data as any).reduction ?? 0);

    handleDataChange(setItems({ ...data, total: newTotal }, newItems));
  };

  const addNewDetail = () => {
    const items = getItems(data);
    if (isCommande) {
      const newItem = {
        id: crypto.randomUUID(),
        nom: "",
        quantite: 1,
        prixUnitaire: 0,
        sous_total: 0,
      };
      handleDataChange(setItems(data, [...items, newItem]));
    } else {
      const newDetail: DetailItem = {
        id: crypto.randomUUID(),
        description: "",
        quantite: 1,
        prixUnitaire: 0,
        sous_total: 0,
      };
      handleDataChange(setItems(data, [...items, newDetail]));
    }
  };

  const removeDetail = (index: number) => {
    const items = getItems(data);
    if (!items) return;

    const newItems = items.filter((_: any, i: number) => i !== index);
    const newTotal = newItems.reduce((sum: number, item: any) => sum + (item.quantite * item.prixUnitaire), 0);

    handleDataChange(setItems({ ...data, total: newTotal }, newItems));
  };

  return (
    <div className="w-full py-4 sm:py-6">
      {!hideHeader && (
      <div className="flex justify-between items-center mb-4 sm:mb-6">
        <div className="flex items-center">
          <div className={`p-2 rounded-full mr-3 ${isCommande ? "bg-purple-100" : "bg-orange-100"}`}>
            {isCommande ? (
              <ShoppingCart className="h-6 w-6 text-purple-600" />
            ) : (
              <Receipt className="h-6 w-6 text-orange-600" />
            )}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
              {isCommande ? "COMMANDE" : "FACTURE"}
            </h1>
            <p className="font-medium mt-1 text-md text-gray-600">
              N° {isCommande
                ? (data as CommandeData).commandeNumero
                : (data as FactureData).factureNumero}
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
      )}
      
      {!hideInfoBlocks && (
      <>
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
            <option value="Vérification">Vérification</option>
            <option value="En attente">En attente</option>
            <option value="Validé">Validé</option>
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

      </>
      )}

      {/* Articles */}
      <CollapsibleSection
        title={`Articles${getItems(data).length ? ` · ${getItems(data).length}` : ""}`}
        defaultOpen={articlesOpen ?? true}
        className="mb-6"
      >
        <div className="space-y-3">
          {getItems(data).map((item: any, index: number) => (
            <div key={item.id}>
              <DetailItemForm
                id={item.id}
                description={isCommande ? (item.nom || "") : (item.description || "")}
                quantite={item.quantite}
                prix={item.prixUnitaire}
                sousTotal={item.sous_total}
                detailIndex={index}
                onDelete={() => removeDetail(index)}
                onChange={(changes) => updateDetailItem(index, changes)}
                isEditable={isEditMode}
              />
            </div>
          ))}

          {/* Ajouter un article — après le dernier, façon CDC Builder */}
          {isEditMode && (
            <button
              type="button"
              onClick={addNewDetail}
              className="flex items-center gap-2 w-full py-2.5 border-2 border-dashed border-orange-400
                         rounded-lg text-sm text-orange-600 hover:text-orange-700 hover:border-orange-500
                         hover:bg-orange-100 transition-all justify-center font-medium"
            >
              <PlusCircle className="h-4 w-4" />
              Ajouter un article
            </button>
          )}
        </div>
      </CollapsibleSection>

      {/* ── Total & Remise (bloc indépendant) ── */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        {/* Sous-total */}
        <div className="flex justify-between items-center text-sm mb-2">
          <span className="text-gray-500">Sous-total</span>
          <span className="font-medium text-gray-700">{formatCFA(baseTotal)}</span>
        </div>

          {/* Remise */}
          <div className="flex justify-between items-center text-sm mb-1 pb-2 border-b border-gray-100">
            <span className="text-gray-500">Remise</span>
            {isEditMode ? (
              <div className="flex flex-col items-end gap-1.5">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={baseTotal}
                      value={(data as any).reduction ?? 0}
                      onChange={e => {
                        const newReduction = Number(e.currentTarget.value) || 0;
                        const pct = baseTotal > 0 ? Math.round((newReduction * 100) / baseTotal) : 0;
                        const newTotal = baseTotal - newReduction;
                        setCurrentPercent(pct);
                        handleDataChange({ ...data, reduction: newReduction, total: newTotal });
                      }}
                      className="w-20 h-8 border border-gray-200 rounded-lg px-2 text-xs text-right"
                      aria-label="Montant de la remise"
                    />
                    <span className="text-xs text-gray-400">CFA</span>
                  </div>
                  <span className="text-xs text-gray-300">|</span>
                  <div className="flex items-center gap-1">
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
                      className="w-14 h-8 border border-gray-200 rounded-lg px-2 text-xs text-right"
                      aria-label="Pourcentage de remise"
                    />
                    <span className="text-xs text-gray-400">%</span>
                  </div>
                </div>
              </div>
            ) : (
              <span className="text-orange-600 font-medium">
                −{formatCFA((data as any).reduction ?? 0)} ({currentPercent}%)
              </span>
            )}
          </div>

          {/* Total */}
          <div className="flex justify-between items-center">
            <span className="text-base font-semibold text-gray-800">Total</span>
            <span className="text-lg font-bold text-green-600">{formatCFA(data.total)}</span>
          </div>
        </div>

      {/* Barre d'actions mobile */}
      {!hideMobileBar && isMobile && isEditable && (
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
