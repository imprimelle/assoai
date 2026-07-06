import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X, Plus, Trash2, GripVertical } from 'lucide-react';
import { ProductVariant } from '@/types/product';
import { v4 as uuidv4 } from 'uuid';
import ImageUpload from '@/components/templates/shared/ImageUpload';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCFA } from '@/utils/format';

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

  const removeVariant = (id: string) => onChange(variants.filter(v => v.id !== id));

  const updateVariant = (id: string, field: keyof ProductVariant, value: any) => {
    onChange(variants.map(v => (v.id === id ? { ...v, [field]: value } : v)));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-bold text-gray-800">Variantes</h3>
        {variants.length > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
            {variants.length}
          </span>
        )}
      </div>

      {/* Variant list */}
      <AnimatePresence>
        {variants.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-10 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200"
          >
            <p className="text-sm text-gray-400 font-medium">Aucune variante</p>
            <p className="text-xs text-gray-300 mt-1">Ajoutez des tailles, couleurs ou options</p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {variants.map((variant, idx) => (
              <motion.div
                key={variant.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 50 }}
                transition={{ duration: 0.2 }}
                className="relative bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md hover:border-orange-100 transition-all duration-300 group"
              >
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  {/* Nom */}
                  <div className="sm:col-span-4">
                    <Label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1 block">Nom</Label>
                    <Input
                      value={variant.name}
                      onChange={e => updateVariant(variant.id, 'name', e.target.value)}
                      disabled={!isEditable}
                      className="h-10 rounded-xl border-gray-200 focus:border-orange-400 text-sm font-medium"
                      placeholder="Ex: 2m/1m"
                    />
                  </div>

                  {/* Prix */}
                  <div className="sm:col-span-2">
                    <Label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1 block">Prix (FCFA)</Label>
                    <Input
                      type="number"
                      value={variant.price}
                      onChange={e => updateVariant(variant.id, 'price', parseFloat(e.target.value) || 0)}
                      disabled={!isEditable}
                      className="h-10 rounded-xl border-gray-200 focus:border-orange-400 text-sm font-semibold text-orange-600"
                    />
                  </div>

                  {/* SKU */}
                  <div className="sm:col-span-2">
                    <Label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1 block">Réf.</Label>
                    <Input
                      value={variant.sku || ''}
                      onChange={e => updateVariant(variant.id, 'sku', e.target.value)}
                      disabled={!isEditable}
                      className="h-10 rounded-xl border-gray-200 focus:border-orange-400 text-sm font-mono"
                      placeholder="SKU"
                    />
                  </div>

                  {/* Image */}
                  <div className="sm:col-span-2">
                    <Label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1 block">Image</Label>
                    <ImageUpload
                      imageUrl={variant.image_url || ''}
                      onChange={url => updateVariant(variant.id, 'image_url', url)}
                      label="" placeholder="" isEditable={isEditable}
                    />
                  </div>

                  {/* Price preview + delete */}
                  <div className="sm:col-span-2 flex items-center justify-end gap-2">
                    <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-lg">
                      {formatCFA(variant.price)}
                    </span>
                    {isEditable && (
                      <button
                        onClick={() => removeVariant(variant.id)}
                        className="p-2 rounded-xl text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all duration-200 opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Add new variant form */}
      {isEditable && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-orange-50/50 to-amber-50/50 rounded-2xl p-4 border border-orange-100"
        >
          <p className="text-xs font-semibold text-orange-600 mb-3 flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Nouvelle variante
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-4">
              <Input
                placeholder="Nom (ex: 2m/1m)"
                value={newVariant.name}
                onChange={e => setNewVariant({ ...newVariant, name: e.target.value })}
                className="h-10 rounded-xl border-orange-200 focus:border-orange-400 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <Input
                type="number"
                placeholder="Prix"
                value={newVariant.price?.toString() || ''}
                onChange={e => setNewVariant({ ...newVariant, price: e.target.value === '' ? 0 : parseFloat(e.target.value) || 0 })}
                className="h-10 rounded-xl border-orange-200 focus:border-orange-400 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <Input
                placeholder="Réf."
                value={newVariant.sku || ''}
                onChange={e => setNewVariant({ ...newVariant, sku: e.target.value })}
                className="h-10 rounded-xl border-orange-200 focus:border-orange-400 text-sm font-mono"
              />
            </div>
            <div className="sm:col-span-2">
              <ImageUpload
                imageUrl={newVariant.image_url || ''}
                onChange={url => setNewVariant({ ...newVariant, image_url: url })}
                label="" placeholder="" isEditable={true}
              />
            </div>
            <div className="sm:col-span-2">
              <Button
                type="button"
                onClick={addVariant}
                size="sm"
                className="h-10 w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold shadow-md shadow-orange-200/40 transition-all duration-300"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Ajouter
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default VariantEditor;
