import React, { useState } from "react";
import { TemplateType, TemplateData, TemplateMetadata } from "@/types";
import { 
  FileText, 
  DollarSign, 
  ShoppingCart, 
  Palette, 
  UserPlus,
  Wrench,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { formatCFA } from "@/utils/format";
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

const typeCfg: Record<TemplateType, { hex: string; color: string; bg: string }> = {
  facture:            { hex: "#4F46E5", color: "text-indigo-700", bg: "bg-indigo-100" },
  devis:              { hex: "#059669", color: "text-emerald-700", bg: "bg-emerald-100" },
  commande:           { hex: "#D97706", color: "text-amber-700", bg: "bg-amber-100" },
  cahier_des_charges: { hex: "#7C3AED", color: "text-purple-700", bg: "bg-purple-100" },
  brief:              { hex: "#DB2777", color: "text-pink-700", bg: "bg-pink-100" },
  contact:            { hex: "#0891B2", color: "text-cyan-700", bg: "bg-cyan-100" },
};

const TemplatePreview: React.FC<TemplatePreviewProps> = ({
  templateType, data, metadata, onClick, className = "", showActions = false,
  onAskAI, onCommander, onCreateCahierDesCharges, onCreateDevis, onGeneratePDF, onViewAnalytics
}) => {
  const [isOpen, setIsOpen] = useState(true);

  const getDisplayName = () => {
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

  const getIcon = () => {
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

  const fmtDate = (s: string) => { try { return format(new Date(s), "dd/MM/yyyy", { locale: fr }); } catch { return s; } };
  const extract = (): any => (data && typeof data === 'object' && 'data' in data) ? data.data : data;

  const getDetails = () => {
    const d = extract();
    if (!d || typeof d !== 'object') return { num: "N/A", date: "", client: "Client", montant: "" };
    switch (templateType) {
      case "facture": return { num: d.factureNumero || "N/A", date: d.dateEmission ? fmtDate(d.dateEmission) : "", client: d.client?.nom || "Client", montant: formatCFA(d.total || 0) };
      case "devis": return { num: d.devisNumero || "N/A", date: d.dateEmission ? fmtDate(d.dateEmission) : "", client: d.client?.nom || "Client", montant: formatCFA(d.total || 0) };
      case "commande": return { num: d.commandeNumero || "N/A", date: d.dateCommande ? fmtDate(d.dateCommande) : "", client: d.client?.nom || "Client", montant: formatCFA(d.total || 0) };
      case "cahier_des_charges": return { num: (d as any).cdcNumero || d.titre || "N/A", date: "", client: d.equipe?.length ? `Équipe: ${d.equipe.length} membres` : "", montant: "" };
      default: return { num: "N/A", date: "", client: "Client", montant: "" };
    }
  };

  const displayName = getDisplayName();
  const icon = getIcon();
  const { num, date, client, montant } = getDetails();
  const d = extract();
  const status = d?.statut ? String(d.statut).replace(/_/g, ' ') : undefined;
  const hasV = d && 'version' in d;
  const ver = hasV ? d.version : undefined;
  const latest = hasV && d.is_latest;
  const cfg = typeCfg[templateType] || { hex: "#6B7280", color: "text-gray-700", bg: "bg-gray-100" };

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className={`border rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-all duration-200 group ${className}`}
    >
      <CollapsibleTrigger className="w-full text-left px-4 py-3.5 hover:no-underline">
        <div className="flex items-center gap-3">
          {/* Barre colorée + icône (style projet) */}
          <div className="shrink-0 w-1 self-stretch rounded-full" style={{ backgroundColor: cfg.hex, minHeight: '24px' }} />
          <span className={`text-lg shrink-0 ${cfg.color}`}>{icon}</span>

          {/* Titre + infos */}
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm md:text-base truncate max-w-[180px] sm:max-w-[280px]">{displayName}</h3>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {num !== "N/A" && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium border-0 ${cfg.color} ${cfg.bg}`}>
                  N° {num}
                </span>
              )}
              {date && <span className="text-[10px] text-muted-foreground">{date}</span>}
            </div>
          </div>

          {/* Badges droite */}
          <div className="flex items-center gap-1.5 shrink-0">
            {status && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                getStatusLineState(status) === 'success' ? 'bg-green-50 text-green-700' :
                getStatusLineState(status) === 'warning' ? 'bg-yellow-50 text-yellow-700' : 'bg-gray-50 text-gray-700'
              }`}>{status}</span>
            )}
            {hasV && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">v{ver}</span>}
            {latest && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Latest</span>}
            {isOpen ? <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />}
          </div>
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent className="px-4 pb-4">
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-y-2 pt-2"
              onClick={(e) => { e.stopPropagation(); onClick(); }}
            >
              <div className="flex flex-col text-sm text-gray-800">
                <div className="flex flex-wrap justify-between">
                  {client && <span>{client}</span>}
                  {montant && <span className="font-semibold">{montant}</span>}
                </div>
              </div>
              {showActions && (
                <ActionButtons templateType={templateType} onAskAI={onAskAI} onCommander={onCommander}
                  onCreateCahierDesCharges={onCreateCahierDesCharges} onCreateDevis={onCreateDevis}
                  onGeneratePDF={onGeneratePDF} onViewAnalytics={onViewAnalytics} />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default TemplatePreview;
