import React, { useState } from "react";
import { TemplateType, TemplateData, TemplateMetadata } from "@/types";
import { 
  FileText, 
  DollarSign, 
  ShoppingCart, 
  Palette, 
  UserPlus,
  Wrench,
  ChevronRight,
  Check,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { formatCFA } from "@/utils/format";
import StatusLine from "@/components/ui/StatusLine";
import { getStatusLineState } from "@/utils/status-utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ActionButtons } from "@/components/templates";

interface TemplatePreviewProps {
  templateType: TemplateType;
  data: TemplateData;
  metadata?: TemplateMetadata;
  onClick: () => void;
  className?: string;
  showActions?: boolean;
  onAskAI?: () => void;
  onCommander?: () => void;
  onCreateCahierDesCharges?: () => void;
  onCreateDevis?: () => void;
  onGeneratePDF?: () => void;
  onViewAnalytics?: () => void;
}

const TemplatePreview: React.FC<TemplatePreviewProps> = ({
  templateType,
  data,
  metadata,
  onClick,
  className = "",
  showActions = false,
  onAskAI,
  onCommander,
  onCreateCahierDesCharges,
  onCreateDevis,
  onGeneratePDF,
  onViewAnalytics
}) => {
  const [isOpen, setIsOpen] = useState(true);

  // Obtenir les informations d'affichage en fonction du type de template
  const getTemplateInfo = () => {
    const displayName = metadata?.displayName || getDefaultDisplayName();
    const icon = getTemplateIcon();
    
    return { displayName, icon };
  };

  const getDefaultDisplayName = () => {
    switch (templateType) {
      case "facture": return "Facture";
      case "devis": return "Devis";
      case "commande": return "Commande";
      case "cahier_des_charges": return "Cahier des charges";
      case "brief": return "Brief Graphique";
      case "contact": return "Contact";
      default: return "Document";
    }
  };

  const getTemplateIcon = () => {
    switch (templateType) {
      case "facture": return <DollarSign className="h-5 w-5" />;
      case "devis": return <FileText className="h-5 w-5" />;
      case "commande": return <ShoppingCart className="h-5 w-5" />;
      case "cahier_des_charges": return <Wrench className="h-5 w-5" />;
      case "brief": return <Palette className="h-5 w-5" />;
      case "contact": return <UserPlus className="h-5 w-5" />;
      default: return <FileText className="h-5 w-5" />;
    }
  };

  // Fonction pour formatter la date
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd/MM/yyyy", { locale: fr });
    } catch (e) {
      return dateString;
    }
  };

  // Extract nested data if it exists
  const extractData = (): any => {
    if (!data) return {};
    
    // Handle nested data structure if present
    if (data && typeof data === 'object' && 'data' in data) {
      return data.data;
    }
    
    // Handle direct data
    return data;
  };

  // Extraire les informations clés du template
  const getTemplateDetails = () => {
    // Get the actual data object to work with
    const templateData = extractData();
    
    // Vérifier que data est un objet et non une chaîne ou null/undefined
    if (!templateData || typeof templateData !== 'object') {
      console.error(`TemplatePreview: data is not an object for template type ${templateType}`, templateData);
      return {
        numero: "N/A",
        date: "",
        client: "Client",
        montant: formatCFA(0)
      };
    }

    switch (templateType) {
      case "facture":
        return {
          numero: templateData.factureNumero || "N/A",
          date: templateData.dateEmission ? formatDate(templateData.dateEmission) : "",
          client: templateData.client && templateData.client.nom ? templateData.client.nom : "Client",
          montant: formatCFA(templateData.total || 0)
        };
      case "devis":
        return {
          numero: templateData.devisNumero || "N/A",
          date: templateData.dateEmission ? formatDate(templateData.dateEmission) : "",
          client: templateData.client && templateData.client.nom ? templateData.client.nom : "Client",
          montant: formatCFA(templateData.total || 0)
        };
      case "commande":
        return {
          numero: templateData.commandeNumero || "N/A",
          date: templateData.dateCommande ? formatDate(templateData.dateCommande) : "",
          client: templateData.client && templateData.client.nom ? templateData.client.nom : "Client",
          montant: formatCFA(templateData.total || 0)
        };
      case "cahier_des_charges":
        return {
          numero: (templateData as any).cdcNumero || templateData.titre || "N/A",
          date: "",
          client: templateData.equipe && Array.isArray(templateData.equipe) && templateData.equipe.length > 0 
            ? `Équipe: ${templateData.equipe.length} membres` 
            : "Aucune équipe",
          montant: ""
        };
      default:
        break;
    }
    
    // Fallback si les données ne sont pas dans le format attendu
    console.warn(`TemplatePreview: données invalides pour le type ${templateType}`, templateData);
    return {
      numero: "N/A",
      date: "",
      client: "Client",
      montant: formatCFA(0)
    };
  };

  const { displayName, icon } = getTemplateInfo();
  const details = getTemplateDetails();
  
  // Get the actual data for version information
  const templateData = extractData();

  // Get status if available
  const status = templateData?.statut;
  const statusLabel = status ? String(status).replace(/_/g, ' ') : undefined;

  // Version information
  const hasVersion = templateData && typeof templateData === 'object' && 'version' in templateData;
  const version = hasVersion ? templateData.version : undefined;
  const isLatest = hasVersion && 'is_latest' in templateData ? templateData.is_latest : false;

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className={`bg-white rounded-xl shadow-md border border-gray-200 cursor-pointer overflow-visible w-full max-w-full relative ${className}`}
    >
      <CollapsibleTrigger className="w-full text-left p-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-brand-orange bg-opacity-10 p-2 rounded-full text-brand-orange mr-2">
              {icon}
            </div>
            <div>
              <h3 className="font-medium text-gray-900">{displayName}</h3>
              {details.numero && (
                <span className="text-sm text-gray-600">
                  {templateType === "cahier_des_charges" ? details.numero : `N° ${details.numero}`}
                </span>
              )}
            </div>
          </div>
          {isOpen ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </div>

        {/* Version badge in top-right corner - Only show Latest badge if is_latest=true */}
        {hasVersion && (
          <div className="absolute top-1 right-2 flex items-center gap-1">
            <Badge variant="outline" className="text-[10px] py-0 px-1 h-4">
              v{version}
            </Badge>
            {isLatest && (
              <Badge variant="default" className="bg-emerald-500 text-[10px] py-0 px-1 h-4">
                Latest
              </Badge>
            )}
          </div>
        )}
      </CollapsibleTrigger>

      <CollapsibleContent className="px-3 pb-3">
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-y-2 pt-2"
              onClick={(e) => {
                e.stopPropagation();
                onClick();
              }}
            >
              {/* Détails du document */}
              <div className="flex flex-col text-sm text-gray-800 break-words overflow-visible">
                <div className="flex flex-wrap justify-between">
                  {details.date && <span>{details.date}</span>}
                </div>
                <div className="flex flex-wrap justify-between mt-1">
                  <span>{details.client}</span>
                  {details.montant && <span className="font-semibold">{details.montant}</span>}
                </div>
              </div>
              
              {/* Afficher le statut si disponible */}
              {statusLabel && (
                <div className="mb-1">
                  <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full ${
                    getStatusLineState(statusLabel) === 'success' ? 'bg-green-100 text-green-800' :
                    getStatusLineState(statusLabel) === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                    getStatusLineState(statusLabel) === 'error' ? 'bg-red-100 text-red-800' :
                    getStatusLineState(statusLabel) === 'draft' ? 'bg-gray-100 text-gray-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {statusLabel}
                  </span>
                </div>
              )}
              
              {/* Afficher les boutons d'action si showActions est true */}
              {showActions && (
                <ActionButtons
                  templateType={templateType}
                  onAskAI={onAskAI}
                  onCommander={onCommander}
                  onCreateCahierDesCharges={onCreateCahierDesCharges}
                  onCreateDevis={onCreateDevis}
                  onGeneratePDF={onGeneratePDF}
                  onViewAnalytics={onViewAnalytics}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default TemplatePreview;
