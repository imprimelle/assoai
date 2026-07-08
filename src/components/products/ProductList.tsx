import React, { useState } from 'react';
import ProductCard from './ProductCard';
import { Product } from '@/types/product';
import { Button } from '@/components/ui/button';
import { Plus, Filter, ShoppingBag, Wrench, Search, X } from 'lucide-react';
import SearchInput from '@/components/SearchInput';
import UserFilter from '@/components/UserFilter';
import { usePagination } from '@/hooks/use-pagination';
import { motion, AnimatePresence } from 'framer-motion';
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
  /** Si true, masque le toggle pill Catalogue/Fabrication (chef_technique) */
  hideToggle?: boolean;
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
  hideToggle = false,
}) => {
  const [showFilters, setShowFilters] = useState(false);

  const {
    paginatedItems,
    currentPage,
    totalPages,
    setCurrentPage,
    canGoToNextPage,
    canGoToPreviousPage,
    goToNextPage,
    goToPreviousPage,
  } = usePagination({ itemsPerPage: 8, totalItems: products.length });

  const displayedProducts = paginatedItems(products);

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-4">
        <div className="relative">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-100 to-amber-100 animate-pulse" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-7 h-7 border-[3px] border-t-orange-500 border-orange-200 rounded-full animate-spin" />
          </div>
        </div>
        <p className="text-sm text-gray-400 font-medium">Chargement du catalogue...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ─── HEADER ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-800 tracking-tight">
            {viewMode === 'catalog' ? 'Catalogue' : 'Fabrication'}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
              {products.length}
            </span>
            <p className="text-sm text-gray-400">
              produit{products.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <Button
          onClick={onAddNew}
          className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 rounded-2xl h-11 px-5 shadow-lg shadow-orange-200/40 transition-all duration-300 hover:shadow-orange-300/50 hover:scale-[1.02]"
        >
          <Plus className="h-4 w-4" />
          <span className="font-semibold">Nouveau produit</span>
        </Button>
      </div>

      {/* ─── TOOLBAR FLOATING ─── */}
      <div className="sticky top-4 z-20 bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_4px_30px_-10px_rgba(0,0,0,0.08)] border border-white/80 p-2">
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
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
              className={`flex items-center gap-1.5 rounded-2xl h-9 border-gray-200 transition-all duration-300 ${
                showFilters ? 'bg-orange-50 border-orange-200 text-orange-600' : ''
              }`}
            >
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline text-sm font-medium">Filtres</span>
            </Button>

            {/* Toggle pill */}
            {!hideToggle && (
            <div className="flex rounded-2xl bg-gray-100 p-1 gap-0.5">
              <button
                onClick={() => setViewMode('catalog')}
                className={`relative flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold rounded-xl transition-all duration-300 ${
                  viewMode === 'catalog'
                    ? 'bg-white text-orange-600 shadow-[0_2px_8px_rgba(0,0,0,0.08)]'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <ShoppingBag className="h-4 w-4" />
                <span className="hidden sm:inline">Catalogue</span>
              </button>
              <button
                onClick={() => setViewMode('fabrication')}
                className={`relative flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold rounded-xl transition-all duration-300 ${
                  viewMode === 'fabrication'
                    ? 'bg-white text-blue-600 shadow-[0_2px_8px_rgba(0,0,0,0.08)]'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Wrench className="h-4 w-4" />
                <span className="hidden sm:inline">Fabrication</span>
              </button>
            </div>
            )}
          </div>
        </div>

        {/* Filtres */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.25, 0.4, 0.25, 1] }}
              className="overflow-hidden"
            >
              <div className="mt-3 p-4 rounded-2xl bg-gray-50/80 border border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Filtres actifs</span>
                  {userFilter !== 'ALL' && (
                    <button
                      onClick={() => setUserFilter('ALL')}
                      className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 font-medium"
                    >
                      <X className="h-3 w-3" />
                      Réinitialiser
                    </button>
                  )}
                </div>
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ─── EMPTY STATE ─── */}
      {products.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="py-24 text-center bg-white/60 backdrop-blur-sm rounded-3xl shadow-sm border border-white/80"
        >
          <div className="w-20 h-20 mx-auto mb-5 rounded-3xl bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center shadow-inner">
            <ShoppingBag className="h-10 w-10 text-orange-300" />
          </div>
          <p className="text-gray-500 font-semibold text-lg mb-1">Aucun produit trouvé</p>
          <p className="text-sm text-gray-400 mb-8">
            Commencez par ajouter votre premier produit au catalogue.
          </p>
          <Button
            onClick={onAddNew}
            className="rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-lg shadow-orange-200/40 px-6"
          >
            <Plus className="h-4 w-4 mr-2" />
            Créer un produit
          </Button>
        </motion.div>
      ) : (
        <>
          {/* ─── GRID ─── */}
          <motion.div
            layout
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5"
          >
            <AnimatePresence mode="popLayout">
              {displayedProducts.map((product, index) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onView={onView}
                  viewMode={viewMode}
                  index={index}
                />
              ))}
            </AnimatePresence>
          </motion.div>

          {/* ─── PAGINATION ─── */}
          {totalPages > 1 && (
            <Pagination className="mt-10">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={goToPreviousPage}
                    className={
                      !canGoToPreviousPage ? 'pointer-events-none opacity-50' : ''
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
                    className={!canGoToNextPage ? 'pointer-events-none opacity-50' : ''}
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
