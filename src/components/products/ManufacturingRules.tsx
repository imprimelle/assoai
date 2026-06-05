
import React from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FabricationRules } from '@/types/product';
import { FileText, Lightbulb } from 'lucide-react';

interface ManufacturingRulesProps {
  rules: FabricationRules;
  onChange: (rules: FabricationRules) => void;
  isEditable?: boolean;
}

const ManufacturingRules: React.FC<ManufacturingRulesProps> = ({
  rules,
  onChange,
  isEditable = true,
}) => {
  const data = rules || { description_complete: '', exemples: '' };

  const update = (field: keyof FabricationRules, value: string) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-6 bg-white rounded-md p-4">
      <h3 className="text-lg font-medium">Règles de fabrication</h3>

      {/* Description complète */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-brand-orange" />
          <Label className="text-sm font-semibold">Description complète</Label>
        </div>
        <p className="text-xs text-gray-500">
          Décrivez ici l'ensemble du processus de fabrication : matériaux requis, étapes, 
          calculs, règles spécifiques, options disponibles, etc.
        </p>
        <Textarea
          value={data.description_complete || ''}
          onChange={(e) => update('description_complete', e.target.value)}
          placeholder="Saisissez la description complète des règles de fabrication..."
          rows={14}
          className="bg-white font-mono text-sm resize-y min-h-[200px]"
        />
      </div>

      {/* Exemples */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          <Label className="text-sm font-semibold">Exemples</Label>
        </div>
        <p className="text-xs text-gray-500">
          Ajoutez des exemples concrets de cahiers des charges pour différents scénarios 
          (dimensions, options, configurations types).
        </p>
        <Textarea
          value={data.exemples || ''}
          onChange={(e) => update('exemples', e.target.value)}
          placeholder="Saisissez les exemples de cahiers des charges..."
          rows={14}
          className="bg-white font-mono text-sm resize-y min-h-[200px]"
        />
      </div>
    </div>
  );
};

export default ManufacturingRules;
