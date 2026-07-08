
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Save, X, FileEdit, Eye, ShoppingBag, Wrench } from 'lucide-react';
import ProductForm from './ProductForm';
import { Product, ProductFormData } from '@/types/product';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (productData: ProductFormData) => Promise<void>;
  product?: Product | null;
  mode: 'create' | 'edit' | 'view';
  viewMode: 'catalog' | 'fabrication';
  /** Si true, masque tous les onglets sauf Règles (chef_technique) */
  restrictedView?: boolean;
}

const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  onSave,
  product = null,
  mode,
  viewMode,
  restrictedView = false,
}) => {
  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    description: '',
    main_image_url: null,
    gallery_images: [],
    variants: [],
    manufacturing_rules: { description_complete: '', exemples: '' },
    billing_rules: { description_complete: '', exemples: '' },
  });
  
  const formDataRef = useRef<ProductFormData>(formData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    let next: ProductFormData;
    if (product) {
      next = {
        name: product.name || '',
        description: product.description || '',
        main_image_url: product.main_image_url,
        gallery_images: product.gallery_images || [],
        variants: product.variants || [],
        manufacturing_rules: product.manufacturing_rules || { description_complete: '', exemples: '' },
        billing_rules: product.billing_rules || { description_complete: '', exemples: '' },
      };
    } else {
      next = {
        name: '',
        description: '',
        main_image_url: null,
        gallery_images: [],
        variants: [],
        manufacturing_rules: { description_complete: '', exemples: '' },
        billing_rules: { description_complete: '', exemples: '' },
      };
    }
    setFormData(next);
    formDataRef.current = next;
  }, [product, isOpen]);

  const handleFieldChange = (field: string, value: any) => {
    if (field === 'variants') {
      console.log('[ProductModal] handleFieldChange variants:', {
        isArray: Array.isArray(value),
        length: Array.isArray(value) ? value.length : 'N/A',
      });
    }
    setFormData(prev => {
      const next = { ...prev, [field]: value };
      formDataRef.current = next;
      return next;
    });
  };

  const handleSubmit = useCallback(async () => {
    const data = formDataRef.current;
    if (!data.name.trim()) {
      toast({ title: "Champ requis", description: "Le nom du produit est obligatoire", variant: "destructive" });
      return;
    }
    console.log('[ProductModal] handleSubmit — formData:', {
      name: data.name, variantsCount: data.variants?.length, mode, viewMode,
    });
    try {
      setIsSubmitting(true);
      await onSave(data);
    } catch (error) {
      console.error("Error saving product:", error);
      toast({ title: "Erreur", description: "Une erreur est survenue lors de l'enregistrement du produit", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }, [onSave, mode, viewMode, toast]);

  const isEditable = mode === 'create' || mode === 'edit';

  const modalTitle = (() => {
    const titles = {
      'create': 'Nouveau produit',
      'edit': viewMode === 'catalog' ? 'Modifier le produit' : 'Modifier les règles',
      'view': viewMode === 'catalog' ? 'Détails du produit' : 'Règles de fabrication',
    };
    return titles[mode];
  })();
  
  const ViewIcon = viewMode === 'catalog' ? ShoppingBag : Wrench;
  const ModeIcon = mode === 'view' ? Eye : FileEdit;
  const accentColor = viewMode === 'catalog' ? 'orange' : 'blue';

  return (
    <Dialog open={isOpen} onOpenChange={() => !isSubmitting && onClose()}>
      <DialogContent className="left-0 top-0 translate-x-0 translate-y-0 w-screen max-w-none h-[100dvh] max-h-[100dvh] rounded-none sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:w-full sm:max-w-4xl sm:h-auto sm:max-h-[92vh] sm:rounded-3xl flex flex-col p-0 bg-white/95 backdrop-blur-xl shadow-2xl border-0">
        {/* Header */}
        <div className={`shrink-0 px-4 py-3 sm:px-6 sm:py-5 border-b ${
          viewMode === 'catalog' 
            ? 'bg-gradient-to-r from-orange-50/80 to-amber-50/80 border-orange-100'
            : 'bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border-blue-100'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-2xl shadow-sm ${
                viewMode === 'catalog' 
                  ? 'bg-orange-100 text-orange-600'
                  : 'bg-blue-100 text-blue-600'
              }`}>
                <ViewIcon className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-xl font-bold text-gray-800">{modalTitle}</DialogTitle>
                <p className="text-xs text-gray-400 font-medium mt-0.5">
                  {mode === 'view' ? 'Lecture seule' : isEditable ? 'Édition' : ''}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain bg-white/50">
          <ProductForm
            product={formData}
            onChange={handleFieldChange}
            isEditable={isEditable}
            variants={formData.variants}
            viewMode={viewMode}
            restrictedView={restrictedView}
          />
        </div>

        {/* Footer */}
        <div className={`shrink-0 px-4 py-3 sm:px-6 sm:py-4 border-t flex items-center justify-between gap-3 ${
          viewMode === 'catalog' ? 'border-orange-100' : 'border-blue-100'
        } bg-white/80 backdrop-blur-xl`}>
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isSubmitting}
            className="gap-2 rounded-2xl h-10 px-4 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
            Annuler
          </Button>
          
          {isEditable && (
            <Button
              variant="brand"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className={`gap-2 rounded-2xl h-10 px-6 font-semibold shadow-lg transition-all duration-300 ${
                isSubmitting ? 'opacity-70' : 'hover:scale-[1.02] hover:shadow-xl'
              } ${
                viewMode === 'catalog'
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-orange-200/40'
                  : 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 shadow-blue-200/40'
              }`}
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductModal;
