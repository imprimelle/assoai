
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Save, X, FileEdit, Eye } from 'lucide-react';
import ProductForm from './ProductForm';
import { Product, ProductFormData } from '@/types/product';
import { useToast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (productData: ProductFormData) => Promise<void>;
  product?: Product | null;
  mode: 'create' | 'edit' | 'view';
}

const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  onSave,
  product = null,
  mode,
}) => {
  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    description: '',
    main_image_url: null,
    gallery_images: [],
    variants: [],
    manufacturing_rules: { description_complete: '', exemples: '' },
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Initialize form with product data when available
  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || '',
        description: product.description || '',
        main_image_url: product.main_image_url,
        gallery_images: product.gallery_images || [],
        variants: product.variants || [],
        manufacturing_rules: product.manufacturing_rules || { description_complete: '', exemples: '' },
      });
    } else {
      // Reset form if no product is provided
      setFormData({
        name: '',
        description: '',
        main_image_url: null,
        gallery_images: [],
        variants: [],
        manufacturing_rules: [],
      });
    }
  }, [product, isOpen]);

  // Handle form field changes
  const handleFieldChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Handle form submission
  const handleSubmit = async () => {
    // Basic validation
    if (!formData.name.trim()) {
      toast({
        title: "Champ requis",
        description: "Le nom du produit est obligatoire",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error("Error saving product:", error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de l'enregistrement du produit",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Determine if form is editable
  const isEditable = mode === 'create' || mode === 'edit';

  // Determine modal title
  const modalTitle = {
    'create': 'Créer un produit',
    'edit': 'Modifier le produit',
    'view': 'Détails du produit',
  }[mode];
  
  // Icon corresponding to mode
  const ModeIcon = mode === 'view' ? Eye : FileEdit;
  
  // Animation for dialog content
  const contentAnimation = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
    exit: { opacity: 0, y: 20, transition: { duration: 0.2 } }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto p-0 bg-white rounded-lg shadow-lg">
        <motion.div
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={contentAnimation}
          className="flex flex-col h-full"
        >
          <DialogHeader className="sticky top-0 z-10 bg-white px-6 py-4 border-b border-gray-100 shadow-sm rounded-t-lg">
            <div className="flex items-center">
              <ModeIcon className="mr-2 h-4 w-4 text-brand-orange" />
              <DialogTitle className="text-xl font-semibold text-gray-800">{modalTitle}</DialogTitle>
            </div>
          </DialogHeader>

          <div className="flex-1 px-6 py-4 overflow-y-auto bg-white">
            <ProductForm
              product={formData}
              onChange={handleFieldChange}
              isEditable={isEditable}
              variants={formData.variants} // Pass variants explicitly
            />
          </div>

          <DialogFooter className="sticky bottom-0 z-10 bg-white px-6 py-4 border-t border-gray-100 flex items-center justify-between shadow-[0_-1px_2px_rgba(0,0,0,0.05)] rounded-b-lg">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="gap-1 rounded-lg h-8 px-2.5"
            >
              <X className="h-3.5 w-3.5" />
              Annuler
            </Button>
            
            {isEditable && (
              <Button
                variant="brand"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="gap-1 rounded-lg h-8 px-2.5"
              >
                <Save className="h-3.5 w-3.5" />
                Enregistrer
              </Button>
            )}
          </DialogFooter>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductModal;
