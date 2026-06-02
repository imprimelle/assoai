
import React from "react";
import { Button } from "@/components/ui/button";
import { Brain, FileDown } from "lucide-react";
import { TemplateData, TemplateType } from "@/types";

interface TemplateModalFooterProps {
  isFromChatMessage: boolean;
  handleSave: () => void;
  handleGeneratePDF?: () => void;
  data?: TemplateData;
  templateType?: TemplateType;
  onAskAI?: () => void;
  onClose?: () => void;
}

const TemplateModalFooter: React.FC<TemplateModalFooterProps> = ({
  isFromChatMessage,
  handleSave,
  handleGeneratePDF,
  data,
  templateType,
  onAskAI,
  onClose
}) => {
  if (!isFromChatMessage) {
    return null;
  }

  const handleAskAI = () => {
    // Déléguer l'action à la fonction fournie par le parent
    onAskAI?.();
    
    // Fermer la modale
    if (onClose) {
      onClose();
    }
  };

  return (
    <div className="p-4 mt-auto bg-white border-t w-full rounded-b-lg shadow-inner">
      <div className="flex flex-col gap-2">
        <Button
          variant="default"
          size="lg"
          onClick={handleAskAI}
          className="w-full py-6 bg-brand-orange hover:bg-brand-orange/90 text-white rounded-xl flex items-center justify-center gap-2 shadow-xl text-base"
        >
          <Brain size={20} /> Demander à l'IA
        </Button>
        
        {handleGeneratePDF && (
          <Button
            variant="outline"
            size="default"
            onClick={handleGeneratePDF}
            className="w-full flex items-center justify-center gap-2 bg-white rounded-md"
          >
            <FileDown size={18} /> Générer PDF
          </Button>
        )}
      </div>
    </div>
  );
};

export default TemplateModalFooter;
