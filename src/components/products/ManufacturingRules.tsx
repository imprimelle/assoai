
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Plus } from 'lucide-react';
import { ManufacturingRule } from '@/types/product';
import { v4 as uuidv4 } from 'uuid';

interface ManufacturingRulesProps {
  rules: ManufacturingRule[];
  onChange: (rules: ManufacturingRule[]) => void;
  isEditable?: boolean;
}

const RULE_TYPES = [
  { value: 'découpe', label: 'Découpe' },
  { value: 'assemblage', label: 'Assemblage' },
  { value: 'finition', label: 'Finition' },
  { value: 'peinture', label: 'Peinture' },
  { value: 'emballage', label: 'Emballage' },
  { value: 'autre', label: 'Autre' }
];

const ManufacturingRules: React.FC<ManufacturingRulesProps> = ({
  rules,
  onChange,
  isEditable = false,
}) => {
  const [newRule, setNewRule] = useState<Partial<ManufacturingRule>>({
    type: '',
    description: '',
    timeRequired: undefined,
    materialRequired: '',
  });

  // Ajouter une nouvelle règle
  const addRule = () => {
    if (!newRule.type || !newRule.description) return;
    
    const rule: ManufacturingRule = {
      id: uuidv4(),
      type: newRule.type,
      description: newRule.description,
      timeRequired: newRule.timeRequired,
      materialRequired: newRule.materialRequired,
      specialInstructions: newRule.specialInstructions,
    };
    
    onChange([...rules, rule]);
    
    // Réinitialiser le formulaire
    setNewRule({
      type: '',
      description: '',
      timeRequired: undefined,
      materialRequired: '',
      specialInstructions: '',
    });
  };

  // Supprimer une règle
  const removeRule = (id: string) => {
    onChange(rules.filter(r => r.id !== id));
  };

  // Mettre à jour une règle existante
  const updateRule = (id: string, field: keyof ManufacturingRule, value: any) => {
    onChange(
      rules.map(r => 
        r.id === id ? { ...r, [field]: value } : r
      )
    );
  };

  return (
    <div className="space-y-4 bg-white rounded-md p-4">
      <h3 className="text-lg font-medium">Règles de fabrication</h3>
      
      {/* Liste des règles */}
      <div className="space-y-4">
        {rules.length === 0 ? (
          <p className="text-sm text-gray-500 italic bg-white rounded-md p-4 shadow-sm">Aucune règle de fabrication définie</p>
        ) : (
          <div className="space-y-4">
            {rules.map((rule) => (
              <div 
                key={rule.id} 
                className="p-4 border rounded-md bg-white shadow-sm space-y-3"
              >
                <div className="flex flex-wrap gap-3">
                  <div className="w-full md:w-1/3">
                    <Label className="text-xs">Type d'opération</Label>
                    {isEditable ? (
                      <Select
                        value={rule.type}
                        onValueChange={(value) => updateRule(rule.id, 'type', value)}
                        disabled={!isEditable}
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Sélectionner un type" />
                        </SelectTrigger>
                        <SelectContent className="bg-white rounded-md">
                          {RULE_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="py-2 px-3 bg-white border rounded-md">
                        {rule.type}
                      </div>
                    )}
                  </div>
                  <div className="w-full md:w-1/4">
                    <Label className="text-xs">Temps requis (min)</Label>
                    <Input
                      type="number"
                      value={rule.timeRequired || ''}
                      onChange={(e) => updateRule(rule.id, 'timeRequired', parseInt(e.target.value) || undefined)}
                      disabled={!isEditable}
                      className="bg-white"
                    />
                  </div>
                  <div className="w-full md:w-1/3">
                    <Label className="text-xs">Matériel requis</Label>
                    <Input
                      value={rule.materialRequired || ''}
                      onChange={(e) => updateRule(rule.id, 'materialRequired', e.target.value)}
                      disabled={!isEditable}
                      className="bg-white"
                    />
                  </div>
                </div>
                
                <div>
                  <Label className="text-xs">Description</Label>
                  <Textarea
                    value={rule.description}
                    onChange={(e) => updateRule(rule.id, 'description', e.target.value)}
                    disabled={!isEditable}
                    rows={2}
                    className="bg-white"
                  />
                </div>
                
                <div>
                  <Label className="text-xs">Instructions spéciales</Label>
                  <Textarea
                    value={rule.specialInstructions || ''}
                    onChange={(e) => updateRule(rule.id, 'specialInstructions', e.target.value)}
                    disabled={!isEditable}
                    rows={2}
                    placeholder="Instructions spéciales (facultatif)"
                    className="bg-white"
                  />
                </div>
                
                {isEditable && (
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeRule(rule.id)}
                      className="text-red-500 border-red-200 hover:bg-red-50 hover:text-red-700 bg-white"
                    >
                      <X className="h-4 w-4 mr-1" /> Supprimer
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Formulaire d'ajout de règle */}
      {isEditable && (
        <div className="pt-2 bg-white rounded-md p-4 shadow-sm">
          <h4 className="text-sm font-medium mb-2">Ajouter une règle de fabrication</h4>
          <div className="space-y-3 border-t pt-3">
            <div className="flex flex-wrap gap-3">
              <div className="w-full md:w-1/3">
                <Label className="text-xs">Type d'opération</Label>
                <Select
                  value={newRule.type}
                  onValueChange={(value) => setNewRule({ ...newRule, type: value })}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Sélectionner un type" />
                  </SelectTrigger>
                  <SelectContent className="bg-white rounded-md">
                    {RULE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full md:w-1/4">
                <Label className="text-xs">Temps requis (min)</Label>
                <Input
                  type="number"
                  placeholder="Temps en minutes"
                  value={newRule.timeRequired?.toString() || ''}
                  onChange={(e) => setNewRule({ ...newRule, timeRequired: parseInt(e.target.value) || undefined })}
                  className="bg-white"
                />
              </div>
              <div className="w-full md:w-1/3">
                <Label className="text-xs">Matériel requis</Label>
                <Input
                  placeholder="Matériel nécessaire"
                  value={newRule.materialRequired || ''}
                  onChange={(e) => setNewRule({ ...newRule, materialRequired: e.target.value })}
                  className="bg-white"
                />
              </div>
            </div>
            
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea
                placeholder="Description de l'étape de fabrication"
                value={newRule.description || ''}
                onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                rows={2}
                className="bg-white"
              />
            </div>
            
            <div>
              <Label className="text-xs">Instructions spéciales</Label>
              <Textarea
                placeholder="Instructions spéciales (facultatif)"
                value={newRule.specialInstructions || ''}
                onChange={(e) => setNewRule({ ...newRule, specialInstructions: e.target.value })}
                rows={2}
                className="bg-white"
              />
            </div>
            
            <div className="pt-2">
              <Button
                type="button"
                onClick={addRule}
                className="bg-brand-orange hover:bg-brand-orange/90 text-white"
              >
                <Plus className="h-4 w-4 mr-1" /> Ajouter la règle
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManufacturingRules;
