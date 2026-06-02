import React from "react";
import { TemplateType } from "@/types";
import {
  Receipt,
  FileSpreadsheet,
  ShoppingCart,
  Palette,
  UserPlus,
  FileText,
  ClipboardList,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface QuoteMessageProps {
  templateType: TemplateType;
  numero?: string;
  client?: string;
  montant?: string;
  date?: string;
  title?: string;
  version?: number;
  isLatest?: boolean;
  onClick?: () => void;
  className?: string;
}

const ACCENT_BORDER: Record<TemplateType, string> = {
  facture: "border-brand-orange",
  devis: "border-blue-500",
  commande: "border-green-500",
  cahier_des_charges: "border-purple-500",
  brief: "border-pink-500",
  contact: "border-teal-500",
};

const ACCENT_BG: Record<TemplateType, string> = {
  facture: "bg-brand-orange/05",
  devis: "bg-blue-50",
  commande: "bg-green-50",
  cahier_des_charges: "bg-purple-50",
  brief: "bg-pink-50",
  contact: "bg-teal-50",
};

const QuoteMessage: React.FC<QuoteMessageProps> = ({
  templateType,
  numero,
  client,
  montant,
  date,
  title,
  version,
  isLatest,
  onClick,
  className,
}) => {
  const displayName = title ||
    (templateType === "facture" ? "Facture" :
    templateType === "devis" ? "Devis" :
    templateType === "commande" ? "Commande" :
    templateType === "cahier_des_charges" ? "Cahier des charges" :
    templateType === "brief" ? "Brief" :
    templateType === "contact" ? "Contact" :
    "Document");

  const getIcon = () => {
    switch (templateType) {
      case "facture": return <Receipt className="h-5 w-5 text-brand-orange" />;
      case "devis": return <FileSpreadsheet className="h-5 w-5 text-blue-500" />;
      case "commande": return <ShoppingCart className="h-5 w-5 text-green-500" />;
      case "cahier_des_charges": return <ClipboardList className="h-5 w-5 text-purple-500" />;
      case "brief": return <Palette className="h-5 w-5 text-pink-500" />;
      case "contact": return <UserPlus className="h-5 w-5 text-teal-500" />;
      default: return <FileText className="h-5 w-5 text-gray-500" />;
    }
  };

  const icon = getIcon();
  const formattedAmount = montant ? `${montant} €` : undefined;
  const accentBorder = ACCENT_BORDER[templateType] || "border-gray-200";
  const accentBg = ACCENT_BG[templateType] || "bg-gray-50";
  const isClickable = !!onClick;

  return (
    <motion.div
      whileHover={isClickable ? { scale: 1.01 } : {}}
      whileTap={isClickable ? { scale: 0.98 } : {}}
      onClick={onClick}
      className={cn(
        "border-l-2 bg-white shadow-sm rounded-xl p-3 mb-4 max-w-[80%]",
        accentBorder,
        isClickable && "cursor-pointer hover:shadow-lg",
        className
      )}
      style={{ marginBottom: "calc(1rem + env(safe-area-inset-bottom))" }} // Ajustement pour éviter de chevaucher la bannière PWA
    >
      <div className="flex items-start">
        <div className={cn(
          "flex-shrink-0 rounded-full p-2 shadow-lg",
          accentBg
        )}>
          {icon}
        </div>
        <div className="ml-3 flex-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-900">{displayName}</span>
            {version !== undefined && (
              <div className="flex space-x-1">
                <span className="text-[10px] font-medium text-gray-500 px-1 py-0.5 border rounded">v{version}</span>
                {isLatest && (
                  <span className="text-[10px] font-medium text-white px-1 py-0.5 bg-emerald-500 rounded">Latest</span>
                )}
              </div>
            )}
          </div>
          <div className="mt-1 flex flex-wrap text-xs text-gray-600 space-x-2">
            {numero && <span>N° {numero}</span>}
            {client && <span>{client}</span>}
            {formattedAmount && <span className="font-medium text-gray-800">{formattedAmount}</span>}
            {date && <span>{date}</span>}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default QuoteMessage;
