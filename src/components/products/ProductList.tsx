
import React, { useState } from 'react';
import ProductCard from './ProductCard';
import { Product } from '@/types/product';
import { Button } from '@/components/ui/button';
import { Plus, Filter, SlidersHorizontal, Grid, List } from 'lucide-react';
import SearchInput from '@/components/SearchInput';
import UserFilter from '@/components/UserFilter';
import { usePagination } from '@/hooks/use-pagination';
import { 
  Pagination, 
  PaginationContent, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious 
} from '@/components/ui/pagination';

interface ProductListProps {
  products: Product[];
  isLoading: boolean;
  onAddNew: () => void;
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
  onView: (product: Product) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  userFilter: string;
  setUserFilter: (filter: string) => void;
}

const ProductList: React.FC<ProductListProps> = ({
  products,
  isLoading,
  onAddNew,
  onEdit,
  onDelete,
  onView,
  searchTerm,
  setSearchTerm,
  userFilter,
  setUserFilter,
}) => {
  // États pour la mise en page et les filtres
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  
  // Pagination
  const { 
    paginatedItems,
    currentPage,
    totalPages,
    setCurrentPage,
    canGoToNextPage,
    canGoToPreviousPage,
    goToNextPage,
    goToPreviousPage
  } = usePagination({
    itemsPerPage: 8,
    totalItems: products.length
  });
  
  // Liste de produits paginée
  const displayedProducts = paginatedItems(products);

  // Récupérer l'utilisateur courant du localStorage
  const currentUser = React.useMemo(() => {
    const storedUser = localStorage.getItem('currentUser');
    return storedUser ? JSON.parse(storedUser) : { id: 'unknown', role: 'user' };
  }, []);

  if (isLoading) {
    return (
      <div className="py-12 flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-t-brand-orange border-opacity-50 rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-600">Chargement des produits...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Catalogue de produits</h2>
        <Button onClick={onAddNew} className="flex items-center gap-2 bg-brand-orange hover:bg-orange-600">
          <Plus className="h-4 w-4" />
          <span>Nouveau produit</span>
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
          <div className="w-full md:w-64 relative">
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Rechercher un produit..."
              onUserTagsChange={() => {}}
              className="w-full"
            />
          </div>
          
          <div className="flex items-center gap-2 ml-auto">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowFilters(!showFilters)} 
              className="flex items-center gap-1"
            >
              <Filter className="h-4 w-4" />
              <span className="hidden md:inline">Filtres</span>
            </Button>
            
            <div className="flex border rounded-md overflow-hidden">
              <Button 
                variant={viewMode === 'grid' ? "default" : "ghost"}
                size="sm" 
                onClick={() => setViewMode('grid')} 
                className="rounded-none border-0"
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button 
                variant={viewMode === 'list' ? "default" : "ghost"}
                size="sm" 
                onClick={() => setViewMode('list')} 
                className="rounded-none border-0"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        
        {/* Filtres additionnels */}
        {showFilters && (
          <div className="mt-4 p-4 border rounded-md bg-gray-50 animate-fadeIn">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
              <div className="w-full md:w-auto">
                <UserFilter
                  currentUser={currentUser}
                  onSelect={setUserFilter}
                  selectedValue={userFilter}
                />
              </div>
              
              {/* Autres filtres peuvent être ajoutés ici */}
            </div>
          </div>
        )}
      </div>

      {/* Affichage des résultats avec compteur */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">
          {products.length} produit{products.length !== 1 ? 's' : ''} trouvé{products.length !== 1 ? 's' : ''}
        </p>
      </div>

      {products.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-lg shadow-sm border">
          <p className="text-gray-500 mb-4">Aucun produit trouvé.</p>
          <Button onClick={onAddNew} variant="outline" className="mt-4">
            Créer un produit
          </Button>
        </div>
      ) : (
        <>
          {/* Grid ou Liste selon le mode d'affichage */}
          <div className={viewMode === 'grid' 
            ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6" 
            : "flex flex-col gap-4"
          }>
            {displayedProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onEdit={onEdit}
                onDelete={onDelete}
                onView={onView}
                viewMode={viewMode}
              />
            ))}
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <Pagination className="mt-8">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    onClick={goToPreviousPage}
                    className={!canGoToPreviousPage ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
                
                {Array.from({ length: totalPages }).map((_, index) => (
                  <PaginationItem key={index}>
                    <PaginationLink
                      isActive={currentPage === index + 1}
                      onClick={() => setCurrentPage(index + 1)}
                    >
                      {index + 1}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                
                <PaginationItem>
                  <PaginationNext 
                    onClick={goToNextPage} 
                    className={!canGoToNextPage ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </>
      )}
    </div>
  );
};

export default ProductList;
