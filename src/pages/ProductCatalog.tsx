
import React, { useState, useCallback, useMemo } from 'react';
import { ProductList, ProductModal } from '@/components/products';
import { useProducts } from '@/hooks/useProducts';
import { Product, ProductFormData } from '@/types/product';
import { useToast } from '@/components/ui/use-toast';
import { useDebounce } from '@/hooks/use-debounce';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const ProductCatalog = () => {
  // États pour gérer les filtres (local)
  const [localSearchTerm, setLocalSearchTerm] = useState('');
  const [userFilter, setUserFilter] = useState('ALL');
  
  // Debounce le terme de recherche pour éviter les requêtes à chaque frappe
  const debouncedSearchTerm = useDebounce(localSearchTerm, 500);
  
  // États pour gérer le modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  // État pour la confirmation de suppression
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  
  // Hooks
  const { products, createProduct, updateProduct, deleteProduct, isLoading } = useProducts(debouncedSearchTerm, userFilter);
  const { toast } = useToast();
  
  // Récupérer l'utilisateur courant du localStorage pour l'associer aux nouveaux produits
  const currentUser = useMemo(() => {
    const storedUser = localStorage.getItem('currentUser');
    return storedUser ? JSON.parse(storedUser) : { id: 'unknown', role: 'user' };
  }, []);
  
  // Gestionnaires d'événements pour le modal
  const handleAddNew = () => {
    setSelectedProduct(null);
    setModalMode('create');
    setIsModalOpen(true);
  };
  
  const handleEdit = (product: Product) => {
    setSelectedProduct(product);
    setModalMode('edit');
    setIsModalOpen(true);
  };
  
  const handleView = (product: Product) => {
    setSelectedProduct(product);
    setModalMode('view');
    setIsModalOpen(true);
  };
  
  const handleCloseModal = () => {
    setIsModalOpen(false);
  };
  
  // Gestionnaire pour la création/mise à jour de produit
  const handleSaveProduct = async (formData: ProductFormData) => {
    try {
      if (modalMode === 'create') {
        // Ajouter les informations sur l'utilisateur et la session
        const sessionId = localStorage.getItem('persistentSessionId');
        
        await createProduct({
          ...formData,
          created_by: currentUser?.id || undefined,
          session_id: sessionId || undefined,
        });
        
        toast({
          title: "Produit créé",
          description: "Le produit a été ajouté au catalogue avec succès.",
          className: "bg-white rounded-md shadow-md"
        });
      } else if (modalMode === 'edit' && selectedProduct) {
        await updateProduct(selectedProduct.id, formData);
        
        toast({
          title: "Produit mis à jour",
          description: "Les modifications ont été enregistrées avec succès.",
          className: "bg-white rounded-md shadow-md"
        });
      }
      
      // Fermer le modal après la sauvegarde
      handleCloseModal();
    } catch (error) {
      console.error('Error saving product:', error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de l'enregistrement du produit.",
        variant: "destructive",
        className: "bg-white rounded-md shadow-md"
      });
    }
  };
  
  // Gestionnaires pour la suppression
  const handleDeleteRequest = (id: string) => {
    setProductToDelete(id);
    setDeleteConfirmOpen(true);
  };
  
  const handleConfirmDelete = async () => {
    if (productToDelete) {
      try {
        await deleteProduct(productToDelete);
        setDeleteConfirmOpen(false);
        setProductToDelete(null);
        
        toast({
          title: "Produit supprimé",
          description: "Le produit a été supprimé du catalogue avec succès.",
          className: "bg-white rounded-md shadow-md"
        });
      } catch (error) {
        console.error('Error deleting product:', error);
        toast({
          title: "Erreur de suppression",
          description: "Une erreur est survenue lors de la suppression du produit.",
          variant: "destructive",
          className: "bg-white rounded-md shadow-md"
        });
      }
    }
  };
  
  const handleCancelDelete = () => {
    setDeleteConfirmOpen(false);
    setProductToDelete(null);
  };

  return (
    <div className="container mx-auto py-8 px-4 bg-white rounded-lg shadow-sm">
      <ProductList
        products={products}
        isLoading={isLoading}
        onAddNew={handleAddNew}
        onEdit={handleEdit}
        onDelete={handleDeleteRequest}
        onView={handleView}
        searchTerm={localSearchTerm}
        setSearchTerm={setLocalSearchTerm}
        userFilter={userFilter}
        setUserFilter={setUserFilter}
      />
      
      {/* Modal pour créer/éditer/voir un produit */}
      <ProductModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveProduct}
        product={selectedProduct}
        mode={modalMode}
      />
      
      {/* Dialog de confirmation de suppression */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent className="bg-white rounded-lg shadow-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer ce produit ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDelete} className="bg-white">Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProductCatalog;
