
import * as React from "react";
import { Sparkles, ShoppingCart, FileDown, ClipboardList, TrendingUp, FileCheck } from "lucide-react";
import { ActionButton } from "@/components/ui/ActionButton";
import { TemplateType } from "@/types";

interface ActionButtonsProps {
  templateType: TemplateType;
  onAskAI?: () => void;
  onCommander?: () => void;
  onGeneratePDF?: () => void;
  onCreateCahierDesCharges?: () => void;
  onCreateDevis?: () => void;  // New prop for creating Devis
  onViewAnalytics?: () => void;
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({
  templateType,
  onAskAI,
  onCommander,
  onGeneratePDF,
  onCreateCahierDesCharges,
  onCreateDevis,  // Add new prop
  onViewAnalytics
}) => {
  const handleAskAI = () => {
    if (onAskAI) {
      onAskAI();
    }
  };
  
  const handleGeneratePDF = () => {
    if (onGeneratePDF) {
      onGeneratePDF();
    }
  };

  const handleViewAnalytics = () => {
    if (onViewAnalytics) {
      onViewAnalytics();
    }
  };

  return (
    <div className="flex justify-end gap-x-2 flex-wrap mt-2 mb-1">
      {/* Bouton "Demander à l'IA" pour les templates facture et commande */}
      {(templateType === "facture" || templateType === "commande" || templateType === "cahier_des_charges") && onAskAI && (
        <ActionButton 
          icon={Sparkles} 
          label="Demander à l'IA" 
          onClick={handleAskAI} 
          variant="orange" 
        />
      )}
      
      {/* Bouton "Commander" pour les factures */}
      {templateType === "facture" && onCommander && (
        <ActionButton 
          icon={ShoppingCart} 
          label="Commander" 
          onClick={onCommander} 
          variant="green" 
        />
      )}
      
      {/* Bouton "Cahier des charges" pour les commandes */}
      {templateType === "commande" && onCreateCahierDesCharges && (
        <ActionButton 
          icon={ClipboardList} 
          label="Cahier des charges" 
          onClick={onCreateCahierDesCharges} 
          variant="purple"
        />
      )}
      
      {/* Nouveau bouton "Devis" pour les cahiers des charges */}
      {templateType === "cahier_des_charges" && onCreateDevis && (
        <ActionButton 
          icon={FileCheck} 
          label="Devis" 
          onClick={onCreateDevis} 
          variant="blue"
        />
      )}
      
      {/* Bouton "Analytics" pour factures et commandes */}
      {(templateType === "facture" || templateType === "commande") && onViewAnalytics && (
        <ActionButton 
          icon={TrendingUp} 
          label="Analytics" 
          onClick={onViewAnalytics} 
          variant="blue" 
        />
      )}
      
      {/* Bouton "PDF" pour tous les templates - toujours montrer si onGeneratePDF existe */}
      {onGeneratePDF && (
        <ActionButton 
          icon={FileDown} 
          label="PDF" 
          onClick={handleGeneratePDF} 
          variant="gray" 
        />
      )}
    </div>
  );
};
