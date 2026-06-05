
import React, { useState, useEffect } from "react";
import { CahierDesChargesData, MaterialItem, Enseigne } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileSpreadsheet, PlusCircle, Trash2 } from "lucide-react";
import AddressPicker from "../shared/AddressPicker";
import StatusLine from "@/components/ui/StatusLine";
import MaterialSection from "./shared/MaterialSection";
import EnseigneSection from "./shared/EnseigneSection";
import EnseigneFilter from "./shared/EnseigneFilter";
import type { CahierStatus } from "@/types";
import { getStatusLineState } from "@/utils/status-utils";
import CollapsibleSection from "@/components/ui/CollapsibleSection";

const DEFAULT_SECTIONS = ["Découpe", "Éclairage", "Outillage", "Métal", "Vinyl"];

interface CahierDesChargesTemplateProps {
  data: CahierDesChargesData;
  isEditable?: boolean;
  onChange?: (data: CahierDesChargesData) => void;
  onSave?: (data: CahierDesChargesData) => void;
}

const CahierDesChargesTemplate: React.FC<CahierDesChargesTemplateProps> = ({
  data: initialData,
  isEditable = false,
  onChange,
  onSave,
}) => {
  const [isEditMode, setIsEditMode] = useState(isEditable);
  const [data, setData] = useState<CahierDesChargesData>({
    ...initialData,
    enseignes: initialData.enseignes || [],
    equipe: initialData.equipe || []
  });
  const [selectedEnseigneFilter, setSelectedEnseigneFilter] = useState<string | "all">("all");
  const CAHIER_STATUSES: CahierStatus[] = ["Brouillon", "infographie", "demande", "Payé", "Livré"];

  // Migration des données legacy vers le nouveau format
  const migrateToNewFormat = (oldData: CahierDesChargesData): CahierDesChargesData => {
    // Si les enseignes existent déjà, pas de migration nécessaire
    if (oldData.enseignes && oldData.enseignes.length > 0) {
      return oldData;
    }

    // Migration : créer une enseigne par défaut avec les données existantes
    const defaultEnseigne: Enseigne = {
      id: "enseigne-default",
      nom: "Enseigne principale",
      produits: [],
      details: {
        image_url: oldData.image_url,
        dimensions: oldData.dimensions || { largeur: 0, hauteur: 0 },
        technique: oldData.technique || { type_structure: "", method_fabrication: "" }
      },
      materiauxSections: oldData.materiauxSections || {}
    };

    return {
      ...oldData,
      enseignes: [defaultEnseigne],
      // Garder les données legacy pour compatibilité
      materiauxSections: oldData.materiauxSections,
      dimensions: oldData.dimensions,
      technique: oldData.technique,
      image_url: oldData.image_url
    };
  };

  useEffect(() => {
    setIsEditMode(isEditable);
  }, [isEditable]);

  useEffect(() => {
    const migratedData = migrateToNewFormat(initialData);
    setData(migratedData);
  }, [initialData]);

  const handleChange = (newData: Partial<CahierDesChargesData>) => {
    const updated = { ...data, ...newData };
    setData(updated);
    if (onChange) onChange(updated);
  };

  const handleEquipeMembreChange = (index: number, field: string, value: any) => {
    const newEquipe = [...data.equipe];
    newEquipe[index] = { ...newEquipe[index], [field]: value };
    handleChange({ equipe: newEquipe });
  };

  const addEquipeMembre = () => {
    const newEquipe = [
      ...data.equipe,
      { id: `eq-${Date.now()}`, nom: "", role: "" }
    ];
    handleChange({ equipe: newEquipe });
  };

  const removeEquipeMembre = (index: number) => {
    const newEquipe = [...data.equipe];
    newEquipe.splice(index, 1);
    handleChange({ equipe: newEquipe });
  };

  // Gestion des enseignes
  const addEnseigne = () => {
    const newEnseigne: Enseigne = {
      id: `enseigne-${Date.now()}`,
      nom: `Nouvelle enseigne`,
      produits: [],
      details: {
        dimensions: { largeur: 0, hauteur: 0 },
        technique: { type_structure: "", method_fabrication: "" }
      },
      materiauxSections: {}
    };
    
    const newEnseignes = [...(data.enseignes || []), newEnseigne];
    handleChange({ enseignes: newEnseignes });
  };

  const updateEnseigne = (index: number, changes: Partial<Enseigne>) => {
    const newEnseignes = [...(data.enseignes || [])];
    newEnseignes[index] = { ...newEnseignes[index], ...changes };
    handleChange({ enseignes: newEnseignes });
  };

  const removeEnseigne = (index: number) => {
    const newEnseignes = [...(data.enseignes || [])];
    newEnseignes.splice(index, 1);
    handleChange({ enseignes: newEnseignes });
  };

  // Matériaux filtrés selon l'enseigne sélectionnée
  const getFilteredMaterials = () => {
    if (selectedEnseigneFilter === "all") {
      // Combiner tous les matériaux de toutes les enseignes
      const allMaterials: Record<string, MaterialItem[]> = {};
      
      data.enseignes?.forEach(enseigne => {
        if (enseigne.materiauxSections) {
          Object.entries(enseigne.materiauxSections).forEach(([section, items]) => {
            if (!allMaterials[section]) allMaterials[section] = [];
            allMaterials[section].push(...items);
          });
        }
      });
      
      return allMaterials;
    } else {
      // Matériaux de l'enseigne sélectionnée
      const selectedEnseigne = data.enseignes?.find(e => e.id === selectedEnseigneFilter);
      return selectedEnseigne?.materiauxSections || {};
    }
  };

  const filteredMaterials = getFilteredMaterials();
  const nonVides = DEFAULT_SECTIONS.filter(name => (filteredMaterials[name] || []).length > 0);

  return (
    <div className="w-full py-4 sm:py-6">
      <div className="flex justify-between items-center mb-4 sm:mb-6">
        <div className="flex items-center">
          <div className="bg-blue-100 p-2 rounded-full mr-3">
            <FileSpreadsheet className="h-8 w-8 text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Cahier des charges</h2>
            <p className="font-medium mt-1 text-md text-gray-600">
              N° {data.titre}
            </p>
          </div>
        </div>
      </div>

      {/* Statut */}
      <CollapsibleSection title="Statut" defaultOpen={true}>
        <StatusLine
          label={data.statut ?? "Brouillon"}
          status={getStatusLineState((data.statut as CahierStatus) ?? "Brouillon")}
        />
        {isEditMode && (
          <select
            value={data.statut || "Brouillon"}
            onChange={e => handleChange({ statut: e.target.value as CahierStatus })}
            className="mt-2 w-full p-2 border rounded text-sm"
          >
            {CAHIER_STATUSES.map(statusValue => (
              <option key={statusValue} value={statusValue}>{statusValue}</option>
            ))}
          </select>
        )}
      </CollapsibleSection>

      {/* Informations générales */}
      <CollapsibleSection title="Informations générales" defaultOpen={true}>
        <div>
          <Label htmlFor="commandeId">ID de la commande</Label>
          <Input
            id="commandeId"
            value={data.commande_id}
            disabled
            className="h-11 sm:h-10"
          />
        </div>
      </CollapsibleSection>

      {/* Enseignes */}
      <CollapsibleSection title="Enseignes" defaultOpen={true}>
        <div className="space-y-4">
          {data.enseignes?.map((enseigne, index) => (
            <EnseigneSection
              key={enseigne.id}
              enseigne={enseigne}
              isEditable={isEditMode}
              onDelete={() => removeEnseigne(index)}
              onChange={(changes) => updateEnseigne(index, changes)}
              defaultOpen={index === 0}
            />
          ))}
          
          {isEditMode && (
            <Button 
              variant="outline" 
              onClick={addEnseigne}
              className="flex items-center text-brand-orange border-brand-orange hover:bg-brand-orange hover:text-white"
            >
              <PlusCircle className="h-4 w-4 mr-2" /> Ajouter une enseigne
            </Button>
          )}
        </div>
      </CollapsibleSection>

      {/* Équipe */}
      <CollapsibleSection title="Équipe" defaultOpen={true}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="border p-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom</th>
                <th className="border p-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rôle</th>
                {isEditMode && <th className="border p-2 w-16"></th>}
              </tr>
            </thead>
            <tbody>
              {data.equipe?.map((membre, index) => (
                <tr 
                  key={membre.id}
                  className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                >
                  <td className="border p-2">
                    {isEditMode ? (
                      <Input
                        value={membre.nom}
                        onChange={(e) => handleEquipeMembreChange(index, "nom", e.target.value)}
                        placeholder="Nom du membre"
                      />
                    ) : (
                      <span>{membre.nom}</span>
                    )}
                  </td>
                  <td className="border p-2">
                    {isEditMode ? (
                      <Input
                        value={membre.role}
                        onChange={(e) => handleEquipeMembreChange(index, "role", e.target.value)}
                        placeholder="Rôle"
                      />
                    ) : (
                      <span>{membre.role}</span>
                    )}
                  </td>
                  {isEditMode && (
                    <td className="border p-2 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeEquipeMembre(index)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {isEditMode && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={addEquipeMembre}
            className="flex items-center mt-2 text-brand-orange"
          >
            <PlusCircle className="h-4 w-4 mr-1" /> Ajouter un membre
          </Button>
        )}
      </CollapsibleSection>

      {/* Adresse de livraison */}
      <CollapsibleSection title="Adresse de livraison" defaultOpen={true}>
        <AddressPicker
          value={data.deliveryAddress}
          onChange={addr => handleChange({ deliveryAddress: addr })}
          isEditable={isEditMode}
        />
      </CollapsibleSection>

      {/* Matériaux avec filtre */}
      <CollapsibleSection title="Matériaux" defaultOpen={true}>
        <div className="mb-4">
          <EnseigneFilter
            enseignes={data.enseignes || []}
            selectedEnseigneId={selectedEnseigneFilter}
            onFilterChange={setSelectedEnseigneFilter}
          />
        </div>

        {nonVides.length > 0 ? (
          nonVides.map(name => (
            <MaterialSection
              key={`${name}-${selectedEnseigneFilter}`}
              name={name}
              items={filteredMaterials[name] || []}
              isEditable={false} // En lecture seule dans cette vue globale
              onAddItem={() => {}}
              onDeleteItem={() => {}}
              onChangeItem={() => {}}
            />
          ))
        ) : (
          <p className="text-sm text-gray-500 italic">
            {selectedEnseigneFilter === "all" 
              ? "Aucun matériau dans toutes les enseignes" 
              : "Aucun matériau pour cette enseigne"
            }
          </p>
        )}
      </CollapsibleSection>

      {isEditMode && (
        <div className="flex justify-end mt-6">
          <Button
            onClick={(e) => {
              e.preventDefault();
              onSave?.(data);
            }}
            className="px-6"
          >
            Enregistrer
          </Button>
        </div>
      )}
    </div>
  );
};

export default CahierDesChargesTemplate;
