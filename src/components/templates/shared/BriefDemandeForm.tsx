
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Save, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BriefItem {
  description: string;
  prixUnitaire: number;
  image_url?: string;
}

interface BriefDemandeFormData {
  clientName: string;
  projectDescription: string;
  items: BriefItem[];
  notes?: string;
}

interface BriefDemandeFormProps {
  onSubmit: (data: BriefDemandeFormData) => void;
  onCancel: () => void;
  initialData?: Partial<BriefDemandeFormData>;
}

const BriefDemandeForm: React.FC<BriefDemandeFormProps> = ({
  onSubmit,
  onCancel,
  initialData = {}
}) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState<BriefDemandeFormData>({
    clientName: initialData.clientName || '',
    projectDescription: initialData.projectDescription || '',
    items: initialData.items || [{ description: '', prixUnitaire: 0 }],
    notes: initialData.notes || ''
  });

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { description: '', prixUnitaire: 0 }]
    }));
  };

  const removeItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const updateItem = (index: number, field: keyof BriefItem, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.clientName.trim()) {
      toast({
        title: "Erreur",
        description: "Le nom du client est requis",
        variant: "destructive"
      });
      return;
    }

    if (!formData.projectDescription.trim()) {
      toast({
        title: "Erreur", 
        description: "La description du projet est requise",
        variant: "destructive"
      });
      return;
    }

    if (formData.items.some(item => !item.description.trim())) {
      toast({
        title: "Erreur",
        description: "Tous les éléments doivent avoir une description",
        variant: "destructive"
      });
      return;
    }

    onSubmit(formData);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Créer une demande de brief
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X size={16} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="clientName">Nom du client *</Label>
              <Input
                id="clientName"
                value={formData.clientName}
                onChange={(e) => setFormData(prev => ({ ...prev, clientName: e.target.value }))}
                placeholder="Nom du client"
                required
              />
            </div>

            <div>
              <Label htmlFor="projectDescription">Description du projet *</Label>
              <Textarea
                id="projectDescription"
                value={formData.projectDescription}
                onChange={(e) => setFormData(prev => ({ ...prev, projectDescription: e.target.value }))}
                placeholder="Décrivez le projet en détail..."
                required
                className="min-h-[100px]"
              />
            </div>

            <div>
              <Label>Éléments demandés</Label>
              <div className="space-y-3 mt-2">
                {formData.items.map((item, index) => (
                  <div key={index} className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Input
                        value={item.description}
                        onChange={(e) => updateItem(index, 'description', e.target.value)}
                        placeholder="Description de l'élément"
                      />
                    </div>
                    <div className="w-32">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.prixUnitaire}
                        onChange={(e) => updateItem(index, 'prixUnitaire', parseFloat(e.target.value) || 0)}
                        placeholder="Prix estimé"
                      />
                    </div>
                    {formData.items.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeItem(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 size={16} />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addItem}
                className="mt-2"
              >
                <Plus size={16} className="mr-1" /> Ajouter un élément
              </Button>
            </div>

            <div>
              <Label htmlFor="notes">Notes additionnelles</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Notes ou spécifications particulières..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Annuler
            </Button>
            <Button type="submit">
              <Save size={16} className="mr-1" /> Créer la demande
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default BriefDemandeForm;
