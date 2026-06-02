
import { useState } from 'react';

interface UsePaginationProps {
  itemsPerPage: number;
  totalItems: number;
}

interface UsePaginationReturn {
  currentPage: number;
  setCurrentPage: (page: number) => void;
  totalPages: number;
  paginatedItems: <T>(items: T[]) => T[];
  canGoToNextPage: boolean;
  canGoToPreviousPage: boolean;
  goToNextPage: () => void;
  goToPreviousPage: () => void;
}

export function usePagination({
  itemsPerPage,
  totalItems,
}: UsePaginationProps): UsePaginationReturn {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

  // Assurons-nous que currentPage est toujours dans les limites valides
  if (currentPage > totalPages) {
    setCurrentPage(totalPages);
  }

  const canGoToNextPage = currentPage < totalPages;
  const canGoToPreviousPage = currentPage > 1;

  const goToNextPage = () => {
    if (canGoToNextPage) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const goToPreviousPage = () => {
    if (canGoToPreviousPage) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  const paginatedItems = <T>(items: T[]): T[] => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items.slice(startIndex, endIndex);
  };

  return {
    currentPage,
    setCurrentPage,
    totalPages,
    paginatedItems,
    canGoToNextPage,
    canGoToPreviousPage,
    goToNextPage,
    goToPreviousPage,
  };
}
