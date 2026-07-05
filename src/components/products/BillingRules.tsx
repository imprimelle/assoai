
import React from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { BillingRules as BillingRulesType } from '@/types/product';
import { FileText, Lightbulb } from 'lucide-react';

interface BillingRulesProps {
  rules: BillingRulesType;
  onChange: (rules: BillingRulesType) => void;
  isEditable?: boolean;
}

const BillingRules: React.FC<BillingRulesProps> = ({
  rules,
  onChange,
  isEditable = true,
}) => {
  const data = rules || { description_complete: '', exemples: '' };

  const update = (field: keyof BillingRulesType, value: string) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-6 bg-white rounded-md p-4">
      <h3 className="text-lg font-medium">Règles de facturation</h3>

      {/* Description complète */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-purple-600" />
          <Label className="text-sm font-semibold">Formule de prix</Label>
        </div>
        <p className="text-xs text-gray-500">
          Décrivez ici la formule de calcul du prix : coût des matériaux, marge atelier, 
          marge commerciale, main d'œuvre, options, TVA. Utilisez des formules exploitables 
          (ex: Prix = (Surface × prix_m²_matériaux + LED × prix_LED + MO) × marge).
        </p>
        <Textarea
          value={data.description_complete || ''}
          onChange={(e) => update('description_complete', e.target.value)}
          placeholder="Saisissez la formule de prix et les règles de facturation..."
          rows={14}
          className="bg-white font-mono text-sm resize-y min-h-[200px]"
        />
      </div>

      {/* Exemples */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          <Label className="text-sm font-semibold">Exemples de factures</Label>
        </div>
        <p className="text-xs text-gray-500">
          Ajoutez des exemples concrets de factures pour différents scénarios 
          (dimensions, options, configurations types avec prix calculés).
        </p>
        <Textarea
          value={data.exemples || ''}
          onChange={(e) => update('exemples', e.target.value)}
          placeholder="Saisissez les exemples de factures..."
          rows={14}
          className="bg-white font-mono text-sm resize-y min-h-[200px]"
        />
      </div>
    </div>
  );
};

export default BillingRules;
