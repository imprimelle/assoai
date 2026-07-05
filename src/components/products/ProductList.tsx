import React, { useState } from 'react';
import ProductCard from './ProductCard';
import { Product } from '@/types/product';
import { Button } from '@/components/ui/button';
import { Plus, Filter, ShoppingBag, Wrench } from 'lucide-react';
import SearchInput from '@/components/SearchInput';
import UserFilter from '@/components/UserFilter';
import { usePagination } from '@/hooks/use-pagination';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
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
  viewMode: 'catalog' | 'fabrication';
  setViewMode: (mode: 'catalog' | 'fabrication') => void;
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
  viewMode,
  setViewMode,
}) => {
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
    goToPreviousPage,
  } = usePagination({
    itemsPerPage: 8,
    totalItems: products.length,
  });

  const displayedProducts = paginatedItems(products);

  if (isLoading) {
    return (
      <div className="py-16 flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-[3px] border-t-brand-orange border-gray-200 rounded-full animate-spin" />
        <p className="mt-4 text-sm text-gray-500">Chargement du catalogue...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── HEADER ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">
            Catalogue de produits
          </h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {products.length} produit{products.length !== 1 ? 's' : ''}
          </p>
        </div>

        <Button
          onClick={onAddNew}
          className="flex items-center gap-2 bg-brand-orange hover:bg-orange-600 rounded-xl h-10 px-4 shadow-sm shadow-orange-200/50 transition-all hover:shadow-orange-300/60"
        >
          <Plus className="h-4 w-4" />
          <span className="font-medium">Nouveau produit</span>
        </Button>
      </div>

      {/* ─── TOOLBAR ─── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          {/* Search */}
          <div className="flex-1 min-w-0">
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Rechercher un produit..."
              onUserTagsChange={() => {}}
              className="w-full"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-1.5 rounded-xl h-9 border-gray-200"
            >
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline text-sm">Filtres</span>
            </Button>

            {/* Toggle Catalogue / Fabrication */}
            <div className="flex rounded-xl border border-gray-200 overflow-hidden bg-gray-50">
              <button
                onClick={() => setViewMode('catalog')}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-all ${
                  viewMode === 'catalog'
                    ? 'bg-white text-brand-orange shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <ShoppingBag className="h-4 w-4" />
                <span className="hidden sm:inline">Catalogue</span>
              </button>
              <button
                onClick={() => setViewMode('fabrication')}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-all ${
                  viewMode === 'fabrication'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Wrench className="h-4 w-4" />
                <span className="hidden sm:inline">Fabrication</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filtres additionnels */}
        {showFilters && (
          <div className="mt-3 p-4 rounded-xl border border-gray-100 bg-gray-50/50 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
              <div className="w-full sm:w-auto">
                <UserFilter
                  currentUser={
                    JSON.parse(localStorage.getItem('currentUser') || '{}') || {
                      id: 'unknown',
                      role: 'user',
                    }
                  }
                  onSelect={setUserFilter}
                  selectedValue={userFilter}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── EMPTY STATE ─── */}
      {products.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center">
            <ShoppingBag className="h-8 w-8 text-gray-300" />
          </div>
          <p className="text-gray-500 font-medium mb-1">Aucun produit trouvé</p>
          <p className="text-sm text-gray-400 mb-6">
            Commencez par ajouter votre premier produit au catalogue.
          </p>
          <Button onClick={onAddNew} variant="outline" className="rounded-xl">
            Créer un produit
          </Button>
        </div>
      ) : (
        <>
          {/* ─── GRID ─── */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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

          {/* ─── PAGINATION ─── */}
          {totalPages > 1 && (
            <Pagination className="mt-8">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={goToPreviousPage}
                    className={
                      !canGoToPreviousPage
                        ? 'pointer-events-none opacity-50'
                        : ''
                    }
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
                    className={
                      !canGoToNextPage ? 'pointer-events-none opacity-50' : ''
                    }
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
