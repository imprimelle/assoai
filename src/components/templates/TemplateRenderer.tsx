
import React from "react";
import { TemplateType, TemplateData, FactureData, DevisData, CommandeData, CahierDesChargesData } from "@/types";
import FactureTemplate from "./FactureTemplate";
import DevisTemplate from "./DevisTemplate";
import CommandeTemplate from "./CommandeTemplate";
import CahierDesChargesTemplate from "./CahierDesChargesTemplate";
import { useIsMobile } from "@/hooks/use-mobile";
import { appLogger } from "@/utils/logger";

interface TemplateRendererProps {
  templateType: TemplateType;
  data: TemplateData;
  isEditable?: boolean;
  onDataChange?: (data: TemplateData) => void;
  onSave?: (data: TemplateData) => void;
}

const TemplateRenderer: React.FC<TemplateRendererProps> = ({ 
  templateType, 
  data, 
  isEditable = false,
  onDataChange,
  onSave 
}) => {
  const isMobile = useIsMobile();
  
  // Ensure data has the necessary properties for each template type
  const ensureValidData = (type: TemplateType, inputData: TemplateData): TemplateData => {
    const dataCopy = { ...inputData };
    
    // Handle missing properties based on template type
    if (type === 'facture') {
      const factureData = dataCopy as FactureData;
      if (!factureData.details) factureData.details = [];
      
      // Ensure version and is_latest are present
      if (typeof factureData.version === 'undefined') factureData.version = 1;
      if (typeof factureData.is_latest === 'undefined') factureData.is_latest = true;
      
      return factureData;
    } else if (type === 'devis') {
      const devisData = dataCopy as DevisData;
      if (!devisData.details) devisData.details = [];
      
      // Ensure version and is_latest are present
      if (typeof devisData.version === 'undefined') devisData.version = 1;
      if (typeof devisData.is_latest === 'undefined') devisData.is_latest = true;
      
      return devisData;
    } else if (type === 'commande') {
      const commandeData = dataCopy as CommandeData;
      if (!commandeData.items) commandeData.items = [];
      
      // Ensure version and is_latest are present
      if (typeof commandeData.version === 'undefined') commandeData.version = 1;
      if (typeof commandeData.is_latest === 'undefined') commandeData.is_latest = true;
      
      return commandeData;
    } else if (type === 'cahier_des_charges') {
      const cahierData = dataCopy as CahierDesChargesData;
      // Pour le cahier des charges, initialisons les champs si manquants
      if (!cahierData.equipe) cahierData.equipe = [];
      if (!cahierData.dimensions) cahierData.dimensions = { largeur: 0, hauteur: 0 };
      if (!cahierData.technique) cahierData.technique = { 
        type_structure: "", 
        method_fabrication: "" 
      };
      if (!cahierData.materiauxSections) cahierData.materiauxSections = {};
      
      // Ensure version and is_latest are present
      if (typeof cahierData.version === 'undefined') cahierData.version = 1;
      if (typeof cahierData.is_latest === 'undefined') cahierData.is_latest = true;
      
      return cahierData;
    }
    
    return dataCopy;
  };
  
  const safeData = ensureValidData(templateType, data);
  
  // Log version information for debugging
  appLogger.info("TemplateRenderer version info", {
    templateType,
    version: safeData.version,
    is_latest: safeData.is_latest
  });
  
  const handleDataChange = (newData: TemplateData) => {
    // Ensure version and is_latest fields are preserved
    const updatedData = {
      ...newData,
      version: newData.version || data.version || 1,
      is_latest: typeof newData.is_latest !== 'undefined' ? newData.is_latest : true
    };
    
    appLogger.info("TemplateRenderer handleDataChange", {
      templateType,
      version: updatedData.version,
      is_latest: updatedData.is_latest
    });
    
    if (onDataChange) {
      onDataChange(updatedData);
    }
  };

  // Handle save with proper versioning
  const handleSave = (templateData: TemplateData) => {
    // Ensure version and is_latest fields are set
    const dataToSave = {
      ...templateData,
      version: templateData.version || data.version || 1,
      is_latest: typeof templateData.is_latest !== 'undefined' ? templateData.is_latest : true
    };
    
    appLogger.info("TemplateRenderer handleSave", {
      templateType,
      version: dataToSave.version,
      is_latest: dataToSave.is_latest
    });
    
    if (onSave) {
      onSave(dataToSave);
    }
  };

  const templateClassName = `${isEditable ? 'template-edit-mode' : 'template-preview-mode'}`;

  // Vérifier si le template type est valide
  const isValidTemplateType = (type: string): type is TemplateType => {
    return ["facture", "devis", "commande", "cahier_des_charges"].includes(type);
  };

  // Si le type n'est pas valide, on utilise un traitement par défaut
  if (!isValidTemplateType(templateType)) {
    return (
      <div className="p-2 md:p-4 bg-gray-100">
        <div className="text-center p-2 md:p-4">
          <p>Template de type <strong>{templateType}</strong> non implémenté</p>
          <pre className="mt-3 text-left bg-gray-50 p-2 md:p-3 rounded text-xs overflow-auto max-h-32 md:max-h-40">
            {JSON.stringify(safeData, null, 2)}
          </pre>
        </div>
      </div>
    );
  }

  // Rendu spécifique selon le type de template
  switch (templateType) {
    case "facture":
      return (
        <div className={`${templateClassName} w-full`}>
          <div className={`w-full px-2 sm:px-6`}>
            <FactureTemplate 
              data={safeData as FactureData} 
              onSave={handleSave as (data: FactureData) => void}
              isEditable={isEditable}
              onChange={handleDataChange as (data: FactureData) => void}
            />
          </div>
        </div>
      );
    case "devis":
      return (
        <div className={`${templateClassName} w-full`}>
          <div className={`w-full px-2 sm:px-6`}>
            <DevisTemplate 
              data={safeData as DevisData} 
              onSave={handleSave as (data: DevisData) => void}
              isEditable={isEditable}
              onChange={handleDataChange as (data: DevisData) => void}
            />
          </div>
        </div>
      );
    case "commande":
      return (
        <div className={`${templateClassName} w-full`}>
          <div className={`w-full px-2 sm:px-6`}>
            <CommandeTemplate 
              data={safeData as CommandeData} 
              onSave={handleSave as (data: CommandeData) => void}
              isEditable={isEditable}
              onChange={handleDataChange as (data: CommandeData) => void}
            />
          </div>
        </div>
      );
    case "cahier_des_charges":
      return (
        <div className={`${templateClassName} w-full`}>
          <div className={`w-full px-2 sm:px-6`}>
            <CahierDesChargesTemplate 
              data={safeData as CahierDesChargesData} 
              onSave={handleSave as (data: CahierDesChargesData) => void}
              isEditable={isEditable}
              onChange={handleDataChange as (data: CahierDesChargesData) => void}
            />
          </div>
        </div>
      );
    default:
      return (
        <div className="p-2 md:p-4 bg-gray-100">
          <div className="text-center p-2 md:p-4">
            <p>Template de type <strong>{templateType}</strong> non implémenté</p>
            <pre className="mt-3 text-left bg-gray-50 p-2 md:p-3 rounded text-xs overflow-auto max-h-32 md:max-h-40">
              {JSON.stringify(safeData, null, 2)}
            </pre>
          </div>
        </div>
      );
  }
};

export default TemplateRenderer;
