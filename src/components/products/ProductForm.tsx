
import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ImageGallery from './ImageGallery';
import VariantEditor from './VariantEditor';
import ManufacturingRules from './ManufacturingRules';
import BillingRules from './BillingRules';
import { Product, ProductVariant, FabricationRules, BillingRules as BillingRulesType } from '@/types/product';
import { motion } from 'framer-motion';
import { Info, List, Settings, Receipt } from 'lucide-react';

const EMPTY_FABRICATION_RULES: FabricationRules = { description_complete: '', exemples: '' };
const EMPTY_BILLING_RULES: BillingRulesType = { description_complete: '', exemples: '' };

interface ProductFormProps {
  product: Partial<Product>;
  onChange: (field: string, value: any) => void;
  isEditable?: boolean;
  variants?: ProductVariant[];
  viewMode?: 'catalog' | 'fabrication';
}

const ProductForm: React.FC<ProductFormProps> = ({
  product,
  onChange,
  isEditable = true,
  variants,
  viewMode = 'catalog',
}) => {
  const [activeTab, setActiveTab] = useState(viewMode === 'fabrication' ? "rules" : "info");

  const handleMainImageChange = (url: string) => {
    onChange('main_image_url', url);
  };

  const handleAddGalleryImage = (url: string) => {
    const newGallery = [...(product.gallery_images || []), url];
    onChange('gallery_images', newGallery);
  };

  const handleRemoveGalleryImage = (index: number) => {
    const newGallery = [...(product.gallery_images || [])];
    newGallery.splice(index, 1);
    onChange('gallery_images', newGallery);
  };

  const handleVariantsChange = (variants: ProductVariant[]) => {
    onChange('variants', variants);
  };

  const handleRulesChange = (rules: FabricationRules) => {
    onChange('manufacturing_rules', rules);
  };

  const handleBillingRulesChange = (rules: BillingRulesType) => {
    onChange('billing_rules', rules);
  };

  const tabContentAnimation = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.3 } }
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-4 mb-6 w-full">
          <TabsTrigger value="info" className="flex items-center gap-2">
            <Info className="h-4 w-4" />
            <span className="hidden sm:inline">Informations</span>
          </TabsTrigger>

          <TabsTrigger value="variants" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            <span className="hidden sm:inline">Variantes</span>
          </TabsTrigger>

          <TabsTrigger value="rules" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Règles</span>
          </TabsTrigger>

          <TabsTrigger value="billing" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            <span className="hidden sm:inline">Facturation</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-6">
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={tabContentAnimation}
            className="space-y-4 bg-white rounded-lg p-4 shadow-sm"
          >
            <div>
              <Label htmlFor="name" className="text-base font-medium">Nom du produit</Label>
              <Input
                id="name"
                value={product.name || ''}
                onChange={(e) => onChange('name', e.target.value)}
                placeholder="Nom du produit"
                disabled={!isEditable}
                className="mt-1 rounded-lg"
              />
            </div>

            <div>
              <Label htmlFor="description" className="text-base font-medium">Description</Label>
              <Textarea
                id="description"
                value={product.description || ''}
                onChange={(e) => onChange('description', e.target.value)}
                placeholder="Description détaillée du produit"
                rows={4}
                disabled={!isEditable}
                className="mt-1 resize-none rounded-lg"
              />
            </div>



            <div className="pt-4">
              <h3 className="text-lg font-medium mb-4">Images du produit</h3>
              <ImageGallery
                mainImage={product.main_image_url || null}
                galleryImages={product.gallery_images || []}
                onMainImageChange={handleMainImageChange}
                onAddGalleryImage={handleAddGalleryImage}
                onRemoveGalleryImage={handleRemoveGalleryImage}
                isEditable={isEditable}
                variants={product.variants || []}
              />
            </div>
          </motion.div>
        </TabsContent>

        <TabsContent value="variants">
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={tabContentAnimation}
            className="bg-white rounded-lg p-4 shadow-sm"
          >
            <VariantEditor
              variants={product.variants || []}
              onChange={handleVariantsChange}
              isEditable={isEditable}
            />
          </motion.div>
        </TabsContent>

        <TabsContent value="rules">
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={tabContentAnimation}
            className="bg-white rounded-lg p-4 shadow-sm"
          >
            <ManufacturingRules
              rules={product.manufacturing_rules || EMPTY_FABRICATION_RULES}
              onChange={handleRulesChange}
              isEditable={isEditable}
            />
          </motion.div>
        </TabsContent>

        <TabsContent value="billing">
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={tabContentAnimation}
            className="bg-white rounded-lg p-4 shadow-sm"
          >
            <BillingRules
              rules={product.billing_rules || EMPTY_BILLING_RULES}
              onChange={handleBillingRulesChange}
              isEditable={isEditable}
            />
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProductForm;
