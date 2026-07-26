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

// 🆕 Couleurs par type de template (comme les phases projet)
const typeConfig: Record<TemplateType, { hex: string; color: string; bg: string }> = {
  facture:            { hex: "#4F46E5", color: "text-indigo-700", bg: "bg-indigo-100" },
  devis:              { hex: "#059669", color: "text-emerald-700", bg: "bg-emerald-100" },
  commande:           { hex: "#D97706", color: "text-amber-700", bg: "bg-amber-100" },
  cahier_des_charges: { hex: "#7C3AED", color: "text-purple-700", bg: "bg-purple-100" },
  brief:              { hex: "#DB2777", color: "text-pink-700", bg: "bg-pink-100" },
  contact:            { hex: "#0891B2", color: "text-cyan-700", bg: "bg-cyan-100" },
};

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

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd/MM/yyyy", { locale: fr });
    } catch (e) {
      return dateString;
    }
  };

  const extractData = (): any => {
    if (!data) return {};
    if (data && typeof data === 'object' && 'data' in data) return data.data;
    return data;
  };

  const getTemplateDetails = () => {
    const templateData = extractData();
    if (!templateData || typeof templateData !== 'object') {
      return { numero: "N/A", date: "", client: "Client", montant: formatCFA(0) };
    }
    switch (templateType) {
      case "facture":
        return {
          numero: templateData.factureNumero || "N/A",
          date: templateData.dateEmission ? formatDate(templateData.dateEmission) : "",
          client: templateData.client?.nom || "Client",
          montant: formatCFA(templateData.total || 0)
        };
      case "devis":
        return {
          numero: templateData.devisNumero || "N/A",
          date: templateData.dateEmission ? formatDate(templateData.dateEmission) : "",
          client: templateData.client?.nom || "Client",
          montant: formatCFA(templateData.total || 0)
        };
      case "commande":
        return {
          numero: templateData.commandeNumero || "N/A",
          date: templateData.dateCommande ? formatDate(templateData.dateCommande) : "",
          client: templateData.client?.nom || "Client",
          montant: formatCFA(templateData.total || 0)
        };
      case "cahier_des_charges":
        return {
          numero: (templateData as any).cdcNumero || templateData.titre || "N/A",
          date: "",
          client: templateData.equipe?.length ? `Équipe: ${templateData.equipe.length} membres` : "Aucune équipe",
          montant: ""
        };
      default:
        return { numero: "N/A", date: "", client: "Client", montant: formatCFA(0) };
    }
  };

  const displayName = getDefaultDisplayName();
  const icon = getTemplateIcon();
  const details = getTemplateDetails();
  const templateData = extractData();
  const status = templateData?.statut;
  const statusLabel = status ? String(status).replace(/_/g, ' ') : undefined;
  const hasVersion = templateData && typeof templateData === 'object' && 'version' in templateData;
  const version = hasVersion ? templateData.version : undefined;
  const isLatest = hasVersion && 'is_latest' in templateData ? templateData.is_latest : false;
  const cfg = typeConfig[templateType] || { hex: "#6B7280", color: "text-gray-700", bg: "bg-gray-100" };

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className={`border rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-all duration-200 group ${className}`}
    >
      <CollapsibleTrigger className="w-full text-left hover:no-underline py-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center px-4 py-3.5">
          {/* Barre colorée gauche (comme projets) */}
          <div
            className="shrink-0 w-1 self-stretch rounded-full mr-3"
            style={{ backgroundColor: cfg.hex, minHeight: '32px' }}
          />

          <div className="flex items-center gap-3 text-left min-w-0 flex-1">
            <span className={`text-lg shrink-0 ${cfg.color}`}>{icon}</span>
            <div className="min-w-0">
              <h3 className="font-semibold text-sm md:text-base truncate max-w-[180px] sm:max-w-[280px]">
                {displayName}
              </h3>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <Badge variant="outline" className={`text-[10px] border-0 ${cfg.color} ${cfg.bg}`}>
                  {details.numero && details.numero !== "N/A"
                    ? `N° ${details.numero}`
                    : templateType === "cahier_des_charges" ? details.numero : displayName}
                </Badge>
                {details.date && (
                  <span className="text-[10px] text-muted-foreground">{details.date}</span>
                )}
              </div>
            </div>
          </div>

          {/* Badges + chevron à droite (comme projets) */}
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            {statusLabel && (
              <Badge variant="secondary" className={`text-[10px] h-5 cursor-default border-0 ${
                getStatusLineState(statusLabel) === 'success' ? 'bg-green-50 text-green-700' :
                getStatusLineState(statusLabel) === 'warning' ? 'bg-yellow-50 text-yellow-700' :
                'bg-gray-50 text-gray-700'
              }`}>
                {statusLabel}
              </Badge>
            )}
            {hasVersion && (
              <Badge variant="secondary" className="text-[10px] h-5 cursor-default">
                v{version}
              </Badge>
            )}
            {isLatest && (
              <Badge variant="secondary" className="text-[10px] h-5 cursor-default bg-emerald-50 text-emerald-700 border-0">
                Latest
              </Badge>
            )}
            {isOpen ? (
              <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
            )}
          </div>
        </div>
      </CollapsibleTrigger>

      {/* Contenu dépliable */}
      <CollapsibleContent className="px-4 pb-4">
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
              <div className="flex flex-col text-sm text-gray-800 break-words overflow-visible">
                <div className="flex flex-wrap justify-between">
                  <span>{details.client}</span>
                  {details.montant && <span className="font-semibold">{details.montant}</span>}
                </div>
              </div>

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
