
import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import ImageGallery from './ImageGallery';
import VariantEditor from './VariantEditor';
import ManufacturingRules from './ManufacturingRules';
import BillingRules from './BillingRules';
import BomEditor from './BomEditor';
import { Product, ProductVariant, FabricationRules, BillingRules as BillingRulesType } from '@/types/product';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, List, Settings, Receipt, ShoppingBag, Wrench, ChevronDown, ChevronRight } from 'lucide-react';

const EMPTY_FABRICATION_RULES: FabricationRules = { description_complete: '', exemples: '' };
const EMPTY_BILLING_RULES: BillingRulesType = { description_complete: '', exemples: '' };

interface ProductFormProps {
  product: Partial<Product>;
  productId?: string;
  onChange: (field: string, value: any) => void;
  isEditable?: boolean;
  variants?: ProductVariant[];
  viewMode?: 'catalog' | 'fabrication';
  /** Si true, affiche uniquement l'onglet Règles (chef_technique) */
  restrictedView?: boolean;
}

const tabItem = (value: string, icon: React.ReactNode, label: string, active: boolean, accent: string) => (
  <TabsTrigger
    value={value}
    className={`relative flex items-center gap-2 px-5 py-3 text-sm font-semibold rounded-none border-b-2 transition-all duration-300 ${
      active
        ? accent === 'orange'
          ? 'border-orange-500 text-orange-600 bg-orange-50/30'
          : 'border-blue-500 text-blue-600 bg-blue-50/30'
        : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-200'
    }`}
  >
    {icon}
    <span className="hidden sm:inline">{label}</span>
  </TabsTrigger>
);

const ProductForm: React.FC<ProductFormProps> = ({
  product,
  productId,
  onChange,
  isEditable = true,
  variants,
  viewMode = 'catalog',
  restrictedView = false,
}) => {
  const [activeTab, setActiveTab] = useState(() => {
    if (viewMode === 'fabrication') return "bom";
    return "info";
  });
  const [showLegacyRules, setShowLegacyRules] = useState(false);
  const accent = viewMode === 'catalog' ? 'orange' : 'blue';

  const handleMainImageChange = (url: string) => onChange('main_image_url', url);
  const handleAddGalleryImage = (url: string) => onChange('gallery_images', [...(product.gallery_images || []), url]);
  const handleRemoveGalleryImage = (index: number) => {
    const g = [...(product.gallery_images || [])]; g.splice(index, 1); onChange('gallery_images', g);
  };
  const handleVariantsChange = (v: ProductVariant[]) => onChange('variants', v);
  const handleRulesChange = (r: FabricationRules) => onChange('manufacturing_rules', r);
  const handleBillingRulesChange = (r: BillingRulesType) => onChange('billing_rules', r);

  const tabContentVariants = {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.25 } },
    exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
  };

  return (
    <div className="p-4 sm:p-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {!restrictedView && (
        <TabsList className="flex w-full border-b border-gray-200 bg-transparent p-0 h-auto gap-0 rounded-none mb-6">
          {tabItem("info", <Info className="h-4 w-4" />, "Informations", activeTab === "info", accent)}
          {tabItem("variants", <List className="h-4 w-4" />, "Variantes", activeTab === "variants", accent)}
          {tabItem("bom", <Wrench className="h-4 w-4" />, "Nomenclature", activeTab === "bom", accent)}
          {tabItem("billing", <Receipt className="h-4 w-4" />, "Facturation", activeTab === "billing", accent)}
        </TabsList>
        )}

        <AnimatePresence mode="wait">
          {/* Info Tab */}
          {!restrictedView && activeTab === "info" && (
            <motion.div key="info" variants={tabContentVariants} initial="hidden" animate="visible" exit="exit">
              <TabsContent value="info" forceMount className="space-y-6 mt-0">
                <div className="bg-white rounded-2xl p-3 sm:p-5 shadow-sm border border-gray-100 space-y-4">
                  <div>
                    <Label htmlFor="name" className="text-sm font-semibold text-gray-700">Nom du produit</Label>
                    <Input id="name" value={product.name || ''} onChange={(e) => onChange('name', e.target.value)}
                      placeholder="Ex: Caisson Lumineux rectangle" disabled={!isEditable}
                      className="mt-1.5 rounded-xl h-11 border-gray-200 focus:border-orange-400 focus:ring-orange-100" />
                  </div>
                  <div>
                    <Label htmlFor="description" className="text-sm font-semibold text-gray-700">Description</Label>
                    <Textarea id="description" value={product.description || ''} onChange={(e) => onChange('description', e.target.value)}
                      placeholder="Description détaillée..." rows={3} disabled={!isEditable}
                      className="mt-1.5 resize-none rounded-xl border-gray-200 focus:border-orange-400" />
                  </div>
                  <div className="pt-3">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4">Images du produit</h3>
                    <ImageGallery mainImage={product.main_image_url || null} galleryImages={product.gallery_images || []}
                      onMainImageChange={handleMainImageChange} onAddGalleryImage={handleAddGalleryImage}
                      onRemoveGalleryImage={handleRemoveGalleryImage} isEditable={isEditable}
                      variants={product.variants || []} />
                  </div>
                </div>
              </TabsContent>
            </motion.div>
          )}

          {/* Variants Tab */}
          {!restrictedView && activeTab === "variants" && (
            <motion.div key="variants" variants={tabContentVariants} initial="hidden" animate="visible" exit="exit">
              <TabsContent value="variants" forceMount className="mt-0">
                <div className="bg-white rounded-2xl p-3 sm:p-5 shadow-sm border border-gray-100">
                  <VariantEditor variants={product.variants || []} onChange={handleVariantsChange} isEditable={isEditable} />
                </div>
              </TabsContent>
            </motion.div>
          )}

          {/* Nomenclature Tab — toujours visible */}
          {(activeTab === "bom" || restrictedView) && (
            <motion.div key="bom" variants={tabContentVariants} initial="hidden" animate="visible" exit="exit">
              <TabsContent value="bom" forceMount className="mt-0 space-y-4">
                {/* 🆕 BOM structuré — interface principale */}
                <BomEditor
                  productId={productId || ''}
                  isEditable={isEditable}
                />

                {/* Legacy : Règles de fabrication texte libre (collapsible) */}
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowLegacyRules(!showLegacyRules)}
                    className="flex w-full items-center justify-between gap-2 px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors text-sm"
                  >
                    <span className="flex items-center gap-2 text-gray-600">
                      <Settings className="h-4 w-4" />
                      Règles de fabrication (avancé / legacy)
                    </span>
                    <span className="text-gray-400">
                      {showLegacyRules ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </span>
                  </button>
                  {showLegacyRules && (
                    <div className="p-4 border-t border-gray-200">
                      <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                        ℹ️ La nomenclature structurée ci-dessus remplace les règles texte pour le calcul automatique des matériaux. 
                        Cette section est conservée pour les instructions narratives et la rétrocompatibilité.
                      </p>
                      <ManufacturingRules rules={product.manufacturing_rules || EMPTY_FABRICATION_RULES}
                        onChange={handleRulesChange} isEditable={isEditable} />
                    </div>
                  )}
                </div>
              </TabsContent>
            </motion.div>
          )}

          {/* Billing Tab */}
          {!restrictedView && activeTab === "billing" && (
            <motion.div key="billing" variants={tabContentVariants} initial="hidden" animate="visible" exit="exit">
              <TabsContent value="billing" forceMount className="mt-0">
                <div className="bg-white rounded-2xl p-3 sm:p-5 shadow-sm border border-gray-100">
                  <BillingRules rules={product.billing_rules || EMPTY_BILLING_RULES}
                    onChange={handleBillingRulesChange} isEditable={isEditable} />
                </div>
              </TabsContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Tabs>
    </div>
  );
};

export default ProductForm;
