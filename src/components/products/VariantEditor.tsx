import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X, Plus } from 'lucide-react';
import { ProductVariant } from '@/types/product';
import { v4 as uuidv4 } from 'uuid';
import ImageUpload from '@/components/templates/shared/ImageUpload';
import { Textarea } from "@/components/ui/textarea";

interface VariantEditorProps {
  variants: ProductVariant[];
  onChange: (variants: ProductVariant[]) => void;
  isEditable?: boolean;
}

const VariantEditor: React.FC<VariantEditorProps> = ({
  variants,
  onChange,
  isEditable = false,
}) => {
  const [newVariant, setNewVariant] = useState<Partial<ProductVariant>>({
    name: '',
    price: 0,
    sku: '',
    image_url: null,
  });

  const addVariant = () => {
    if (!newVariant.name || newVariant.price === undefined) return;
    const variant: ProductVariant = {
      id: uuidv4(),
      name: newVariant.name,
      price: newVariant.price,
      sku: newVariant.sku || undefined,
      attributes: {},
      image_url: newVariant.image_url || null,
    };
    onChange([...variants, variant]);
    setNewVariant({ name: '', price: 0, sku: '', image_url: null });
  };

  const removeVariant = (id: string) => {
    onChange(variants.filter(v => v.id !== id));
  };

  const updateVariant = (id: string, field: keyof ProductVariant, value: any) => {
    onChange(
      variants.map(v => (v.id === id ? { ...v, [field]: value } : v))
    );
  };

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold">Variantes du produit</h3>

      <div className="space-y-4">
        {variants.length === 0 ? (
          <div className="text-center text-gray-500 italic py-6 bg-gray-50 rounded-lg">
            Aucune variante ajoutée
          </div>
        ) : (
          variants.map(variant => (
            <div
              key={variant.id}
              className="relative bg-white shadow-md rounded-lg p-4 flex flex-col md:flex-row items-center gap-4 hover:shadow-lg transition-shadow"
            >
              {isEditable && (
                <button
                  onClick={() => removeVariant(variant.id)}
                  className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                >
                  <X className="h-5 w-5" />
                </button>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-grow">
                <div>
                   <Label className="text-xs font-medium">Nom</Label>
                   <Textarea
                      value={variant.name}
                      onChange={e => updateVariant(variant.id, 'name', e.target.value)}
                      disabled={!isEditable}
                      className="h-20 resize-none"
                      rows={2}
                   />
                </div>
                <div>
                  <Label className="text-xs font-medium">Prix</Label>
                  <Input
                    type="number"
                    value={variant.price}
                    onChange={e => updateVariant(variant.id, 'price', parseFloat(e.target.value))}
                    disabled={!isEditable}
                    className="h-10"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium">Référence</Label>
                  <Input
                    value={variant.sku || ''}
                    onChange={e => updateVariant(variant.id, 'sku', e.target.value)}
                    disabled={!isEditable}
                    className="h-10"
                  />
                </div>
              </div>

              <div className="w-full sm:w-32">
                <Label className="text-xs font-medium">Image</Label>
                <ImageUpload
                  imageUrl={variant.image_url || ''}
                  onChange={url => updateVariant(variant.id, 'image_url', url)}
                  label=""
                  placeholder=""
                  isEditable={isEditable}
                />
              </div>
            </div>
          ))
        )}
      </div>

      {isEditable && (
        <div className="bg-white shadow-sm rounded-lg p-4 grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
          <div>
            <Label className="text-xs font-medium">Nom</Label>
            <Input
              placeholder="Nom de la variante"
              value={newVariant.name}
              onChange={e => setNewVariant({ ...newVariant, name: e.target.value })}
              className="h-10"
            />
          </div>
          <div>
            <Label className="text-xs font-medium">Prix</Label>
            <Input
              type="number"
              placeholder="Prix"
              value={newVariant.price?.toString() || ''}
              onChange={e => setNewVariant({ ...newVariant, price: parseFloat(e.target.value) })}
              className="h-10"
            />
          </div>
          <div>
            <Label className="text-xs font-medium">Référence</Label>
            <Input
              placeholder="Référence"
              value={newVariant.sku || ''}
              onChange={e => setNewVariant({ ...newVariant, sku: e.target.value })}
              className="h-10"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-2 items-center">
            <Button
              type="button"
              onClick={addVariant}
              size="sm"
              className="h-10 w-full flex items-center justify-center bg-brand-orange text-white hover:bg-brand-orange/90"
            >
              <Plus className="h-4 w-4 mr-2" /> Ajouter
            </Button>
            <ImageUpload
              imageUrl={newVariant.image_url || ''}
              onChange={url => setNewVariant({ ...newVariant, image_url: url })}
              label=""
              placeholder=""
              isEditable={true}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default VariantEditor;
