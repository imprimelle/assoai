
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Product, ProductVariant, FabricationRules } from '@/types/product';
import { Json } from '@/integrations/supabase/types';
import { appLogger } from '@/utils/logger';

// Helper functions to convert JSON data to typed objects
const convertJsonToProductVariant = (jsonData: any): ProductVariant => {
  return {
    id: jsonData.id || '',
    name: jsonData.name || '',
    price: Number(jsonData.price) || 0,
    sku: jsonData.sku,
    attributes: jsonData.attributes,
  };
};

// Helper to convert JSON to FabricationRules
const convertJsonToFabricationRules = (jsonData: any): FabricationRules => {
  if (!jsonData || typeof jsonData !== 'object') {
    return { description_complete: '', exemples: '' };
  }
  return {
    description_complete: typeof jsonData.description_complete === 'string' ? jsonData.description_complete : '',
    exemples: typeof jsonData.exemples === 'string' ? jsonData.exemples : '',
  };
};

// Helper to convert Product to Supabase format
const convertProductToSupabase = (product: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => {
  return {
    name: product.name,
    description: product.description,
    main_image_url: product.main_image_url,
    gallery_images: product.gallery_images as unknown as Json,
    variants: product.variants as unknown as Json,
    manufacturing_rules: product.manufacturing_rules as unknown as Json,
    created_by: product.created_by,
    session_id: product.session_id
  };
};

export function useProducts(searchTerm: string = '', sessionFilter: string = 'ALL') {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();

  // Function to fetch products
  const fetchProducts = useCallback(async () => {
    try {
      setIsLoading(true);
      appLogger.info(`Fetching products with search: "${searchTerm}" and session filter: ${sessionFilter}`);
      
      // Build the query for products
      let query = supabase
        .from('products')
        .select('*');
      
      // Apply session_id filtering if not ALL
      if (sessionFilter !== 'ALL') {
        query = query.or(`session_id.eq.${sessionFilter},created_by.eq.${sessionFilter}`);
      }

      // Apply name search if specified
      if (searchTerm) {
        query = query.ilike('name', `%${searchTerm}%`);
      }
        
      const { data, error: fetchError } = await query.order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      // Convert JSON data to typed Product objects
      const formattedProducts: Product[] = (data || []).map(item => {
        // Convert gallery_images
        const galleryImages = Array.isArray(item.gallery_images) 
          ? item.gallery_images.map(img => String(img))
          : [];
        
        // Convert variants
        const variants = Array.isArray(item.variants)
          ? item.variants.map(v => convertJsonToProductVariant(v))
          : [];
        
        // Convert manufacturing_rules
        const fabricationRules = convertJsonToFabricationRules(item.manufacturing_rules);
        
        // Build the product with correct types
        return {
          id: item.id,
          name: item.name,
          description: item.description || '',
          main_image_url: item.main_image_url,
          gallery_images: galleryImages,
          variants,
          manufacturing_rules: fabricationRules,
          created_at: item.created_at,
          updated_at: item.updated_at,
          created_by: item.created_by || undefined,
          session_id: item.session_id || undefined
        };
      });

      appLogger.info(`Fetched ${formattedProducts.length} products`);
      setProducts(formattedProducts);
      setError(null);
    } catch (err) {
      console.error("Error in useProducts:", err);
      setError(err as Error);
      toast({
        title: "Erreur de chargement des produits",
        description: (err as Error).message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, sessionFilter, toast]);

  // Function to create a product
  const createProduct = async (productData: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      // Convert to Supabase format
      const supabaseProductData = convertProductToSupabase(productData);
      
      const { data, error } = await supabase
        .from('products')
        .insert([supabaseProductData])
        .select();

      if (error) throw error;
      
      toast({
        title: "Produit créé avec succès",
        description: `Le produit "${productData.name}" a été ajouté au catalogue.`,
        variant: "default"
      });

      // Refresh the list
      fetchProducts();
      
      // Convert returned data to Product type
      if (data && data[0]) {
        const newProduct = data[0];
        return {
          id: newProduct.id,
          name: newProduct.name,
          description: newProduct.description || '',
          main_image_url: newProduct.main_image_url,
          gallery_images: Array.isArray(newProduct.gallery_images) 
            ? newProduct.gallery_images.map(String)
            : [],
          variants: Array.isArray(newProduct.variants)
            ? newProduct.variants.map(convertJsonToProductVariant)
            : [],
          manufacturing_rules: newProduct.manufacturing_rules 
            ? convertJsonToFabricationRules(newProduct.manufacturing_rules)
            : { description_complete: '', exemples: '' },
          created_at: newProduct.created_at,
          updated_at: newProduct.updated_at,
          created_by: newProduct.created_by || undefined,
          session_id: newProduct.session_id || undefined
        } as Product;
      }
      
      return null;
    } catch (error) {
      console.error("Error creating product:", error);
      toast({
        title: "Erreur lors de la création du produit",
        description: (error as Error).message,
        variant: "destructive"
      });
      throw error;
    }
  };

  // Function to update a product
  const updateProduct = async (id: string, productData: Partial<Product>) => {
    try {
      // Convert to Supabase format
      const supabaseProductData: Record<string, any> = {};
      
      if (productData.name !== undefined) supabaseProductData.name = productData.name;
      if (productData.description !== undefined) supabaseProductData.description = productData.description;
      if (productData.main_image_url !== undefined) supabaseProductData.main_image_url = productData.main_image_url;
      if (productData.gallery_images !== undefined) supabaseProductData.gallery_images = productData.gallery_images as unknown as Json;
      if (productData.variants !== undefined) supabaseProductData.variants = productData.variants as unknown as Json;
      if (productData.manufacturing_rules !== undefined) supabaseProductData.manufacturing_rules = productData.manufacturing_rules as unknown as Json;
      
      const { error } = await supabase
        .from('products')
        .update(supabaseProductData)
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: "Produit mis à jour",
        description: "Les modifications ont été enregistrées avec succès.",
        variant: "default"
      });

      // Refresh the list
      fetchProducts();
    } catch (error) {
      console.error("Error updating product:", error);
      toast({
        title: "Erreur lors de la mise à jour",
        description: (error as Error).message,
        variant: "destructive"
      });
      throw error;
    }
  };

  // Function to delete a product
  const deleteProduct = async (id: string) => {
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: "Produit supprimé",
        description: "Le produit a été supprimé du catalogue.",
        variant: "default"
      });

      // Refresh the list
      fetchProducts();
    } catch (error) {
      console.error("Error deleting product:", error);
      toast({
        title: "Erreur lors de la suppression",
        description: (error as Error).message,
        variant: "destructive"
      });
      throw error;
    }
  };

 // Initial product fetch : ne réagit qu’aux vrais changements de filtre
 useEffect(() => {
   fetchProducts();
 // On dépend directement des paramètres (searchTerm et sessionFilter),
 // ce qui évite les relances inutiles si la fonction fetchProducts
 // est recréée pour d’autres raisons (ex: toast)
 }, [searchTerm, sessionFilter]);

  return { 
    products, 
    isLoading, 
    error,
    refetch: fetchProducts,
    createProduct,
    updateProduct,
    deleteProduct
  };
}
