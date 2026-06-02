
import React from "react";
import { Button } from "@/components/ui/button";
import { TemplateType } from "@/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, FileCheck } from "lucide-react";

interface TemplateSelectorProps {
  onSelect: (templateType: TemplateType) => void;
}

const TemplateSelector: React.FC<TemplateSelectorProps> = ({ onSelect }) => {
  const templates: Array<{ type: TemplateType; name: string; icon: React.ReactNode; description: string }> = [
    { 
      type: "facture", 
      name: "Facture", 
      icon: <FileText className="h-6 w-6 text-brand-orange" />, 
      description: "Créer une facture avec articles, prix et informations client" 
    },
    { 
      type: "devis", 
      name: "Devis", 
      icon: <FileCheck className="h-6 w-6 text-brand-orange" />, 
      description: "Créer un devis avec durée de validité, articles et prix" 
    },
  ];

  return (
    <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-200">
      <h2 className="text-lg font-semibold mb-3 text-brand-dark">Sélectionner un template</h2>
      <ScrollArea className="h-72 rounded-md">
        <div className="grid grid-cols-1 gap-3 p-1">
          {templates.map((template) => (
            <Button
              key={template.type}
              variant="outline"
              className="justify-start h-auto py-4 px-4 hover:bg-gray-50"
              onClick={() => onSelect(template.type)}
            >
              <div className="flex items-start">
                <div className="flex-shrink-0 mr-4">{template.icon}</div>
                <div className="text-left">
                  <h3 className="font-medium">{template.name}</h3>
                  <p className="text-sm text-gray-500">{template.description}</p>
                </div>
              </div>
            </Button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export default TemplateSelector;
