
import React from "react";
import { TemplateType } from "@/types";
import { 
  Receipt, 
  FileSpreadsheet, 
  ShoppingCart, 
  Palette, 
  UserPlus,
  ArrowRight,
  X,
  FileText,
  ClipboardList
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface TemplateQuoteCardProps {
  templateType: TemplateType;
  clientName: string;
  montant?: string;
  templateId?: string;
  onClick?: () => void;
  additionalText?: string;
  className?: string;
  onRemove?: () => void;
  showRemoveButton?: boolean;
  isWhatsAppStyle?: boolean;
  title?: string;
}

const TemplateQuoteCard: React.FC<TemplateQuoteCardProps> = ({
  templateType,
  clientName,
  montant,
  templateId,
  onClick,
  additionalText,
  className,
  onRemove,
  showRemoveButton = false,
  isWhatsAppStyle = false,
  title
}) => {
  // Obtenir le nom d'affichage et l'icône en fonction du type de template
  const getTemplateInfo = () => {
    const displayName = title || getDefaultDisplayName();
    const icon = getTemplateIcon();
    const color = getTemplateColor();
    
    return { displayName, icon, color };
  };

  const getDefaultDisplayName = () => {
    switch (templateType) {
      case "facture": return "Facture";
      case "devis": return "Devis";
      case "commande": return "Commande";
      case "cahier_des_charges": return "Cahier des charges";
      case "brief": return "Brief";
      case "contact": return "Contact";
      default: return "Document";
    }
  };

  const getTemplateIcon = () => {
    switch (templateType) {
      case "facture": return <Receipt className="h-5 w-5 text-brand-orange" />;
      case "devis": return <FileSpreadsheet className="h-5 w-5 text-blue-500" />;
      case "commande": return <ShoppingCart className="h-5 w-5 text-green-500" />;
      case "cahier_des_charges": return <ClipboardList className="h-5 w-5 text-purple-500" />;
      case "brief": return <Palette className="h-5 w-5 text-purple-500" />;
      case "contact": return <UserPlus className="h-5 w-5 text-teal-500" />;
      default: return <Receipt className="h-5 w-5 text-gray-500" />;
    }
  };

  const getTemplateColor = () => {
    switch (templateType) {
      case "facture": return "border-brand-orange";
      case "devis": return "border-blue-500";
      case "commande": return "border-green-500";
      case "cahier_des_charges": return "border-purple-500";
      case "brief": return "border-purple-500";
      case "contact": return "border-teal-500";
      default: return "border-gray-500";
    }
  };

  const { displayName, icon, color } = getTemplateInfo();
  
  // Formatter le montant si c'est un nombre
  const formattedAmount = montant;
    
  // Empêcher la propagation des événements pour le bouton de suppression
  const handleRemoveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRemove) {
      onRemove();
    }
  };
  
  // Style WhatsApp pour les citations dans la zone de saisie
  if (isWhatsAppStyle) {
    return (
      <div 
        className={cn(
          `relative pl-3 pr-2 py-2 border-l-4 ${color} bg-opacity-5 bg-gray-50 rounded-md flex justify-between items-center w-full`,
          className
        )}
        onClick={onClick}
      >
        <div className="flex flex-col">
          <div className="font-medium text-gray-900">{displayName}</div>
          <div className="text-sm text-gray-600 truncate max-w-[200px]">
            {templateId && <span className="mr-1">{templateId}</span>}
            {clientName && <span>– {clientName}</span>}
            {formattedAmount && <span>{" – "}{formattedAmount}</span>}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className="rounded-full p-2 bg-white shadow-sm">
            {icon}
          </div>
          
          {showRemoveButton && (
            <button 
              className="p-1 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
              onClick={handleRemoveClick}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    );
  }
  
  // Détermine la couleur d'arrière-plan et du texte en fonction du type de template
  const getBgColor = () => {
    switch (templateType) {
      case "facture": return "bg-orange-50";
      case "devis": return "bg-blue-50";
      case "commande": return "bg-green-50";
      case "cahier_des_charges": return "bg-purple-50";
      case "brief": return "bg-purple-50";
      case "contact": return "bg-teal-50";
      default: return "bg-gray-50";
    }
  };
  
  const bgColor = getBgColor();
  
  // Style original (carte dans le fil de discussion)
  return (
    <>
      <motion.div
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={onClick}
        className={cn(
          `${bgColor} rounded-lg shadow-sm flex justify-between items-center p-3 cursor-pointer w-full`,
          className
        )}
      >
        <div className="flex flex-col pr-2 flex-1">
          <div className="font-medium text-sm text-gray-900">{displayName}</div>
          <div className="text-sm text-gray-700 truncate max-w-[200px]">{clientName}</div>
          {formattedAmount && (
            <div className="font-semibold text-sm text-gray-900">{formattedAmount}</div>
          )}
        </div>
        
        <div className="flex items-center justify-center">
          <div className="rounded-full p-2 bg-white shadow-sm">
            {icon}
          </div>
        </div>
      </motion.div>
      
      {additionalText && (
        <div className="text-sm text-gray-700 mt-1 flex items-center">
          <ArrowRight className="h-3 w-3 mr-1" /> {additionalText}
        </div>
      )}
    </>
  );
};

export default TemplateQuoteCard;
