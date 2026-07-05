import React, { useMemo, useCallback } from "react";
import { Package, Tag } from "lucide-react";
import { Product, ProductVariant } from "@/types/product";
import { useProducts } from "@/hooks/useProducts";
import { formatCFA } from "@/utils/format";
import { smartSearch } from "@/utils/productSearch";
import { SearchableDropdown, type DropdownItem } from "./SearchableDropdown";

// ──────────────────────────────────────────────
// Types locaux enrichis
// ──────────────────────────────────────────────

interface ProductDropdownItem extends DropdownItem {
  price: number;
  isVariant: boolean;
  parentProduct?: string;
  imageUrl?: string | null;
}

interface ProductSuggestionsProps {
  onSelectProduct: (product: {
    description: string;
    prixUnitaire: number;
    image_url?: string | null;
  }) => void;
  currentValue?: string;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

// ──────────────────────────────────────────────
// Composant
// ──────────────────────────────────────────────

const ProductSuggestions: React.FC<ProductSuggestionsProps> = ({
  onSelectProduct,
  currentValue = "",
  disabled = false,
  className = "",
  placeholder = "Rechercher un produit...",
}) => {
  const { products, isLoading } = useProducts("", "ALL");

  // Aplatir produits + variantes en un seul useMemo
  const dropdownItems: ProductDropdownItem[] = useMemo(() => {
    const items: ProductDropdownItem[] = [];

    for (const p of products) {
      if (!p) continue;

      // Produit principal
      items.push({
        id: p.id,
        label: p.name || "Sans nom",
        subtitle: formatCFA(p.variants?.[0]?.price || 0),
        price: p.variants?.[0]?.price || 0,
        isVariant: false,
        imageUrl: p.main_image_url,
        icon: React.createElement(Package, {
          className: "h-4 w-4 text-gray-500",
        }),
      });

      // Variantes
      if (Array.isArray(p.variants)) {
        for (const v of p.variants) {
          if (!v) continue;
          items.push({
            id: v.id || "",
            label: v.name || "Variante",
            subtitle: `${p.name} • ${formatCFA(v.price || 0)}`,
            price: v.price || 0,
            isVariant: true,
            parentProduct: p.name,
            imageUrl: (v as any).image_url || p.main_image_url,
            icon: React.createElement(Tag, {
              className: "h-4 w-4 text-gray-400",
            }),
          });
        }
      }
    }

    return items;
  }, [products]);

  // Filtrage intelligent via smartSearch
  const filterFn = useCallback(
    (items: ProductDropdownItem[], query: string): ProductDropdownItem[] => {
      const scored = smartSearch(query, products);

      // Construire un map productId → score pour le tri
      const productScoreMap = new Map<string, number>();
      const matchedVariantIds = new Set<string>();

      for (const s of scored) {
        productScoreMap.set(s.product.id, s.score);
        for (const v of s.allMatchedVariants) {
          matchedVariantIds.add(v.id);
        }
      }

      // Filtrer et scorer les items
      const result = items
        .filter((item) => {
          if (item.isVariant) return matchedVariantIds.has(item.id);
          return productScoreMap.has(item.id);
        })
        .map((item) => {
          if (item.isVariant) {
            // Trouver le score le plus élevé parmi les matchedVariants
            let bestScore = 0;
            for (const s of scored) {
              for (const v of s.allMatchedVariants) {
                if (v.id === item.id) {
                  bestScore = Math.max(bestScore, s.score);
                }
              }
            }
            return { item, score: bestScore };
          }
          return { item, score: productScoreMap.get(item.id) || 0 };
        })
        .sort((a, b) => b.score - a.score)
        .map((x) => x.item);

      return result;
    },
    [products]
  );

  const handleSelect = (item: ProductDropdownItem) => {
    onSelectProduct({
      description:
        item.isVariant && item.parentProduct
          ? `${item.parentProduct} - ${item.label}`
          : item.label,
      prixUnitaire: item.price,
      image_url: item.imageUrl || undefined,
    });
  };

  return (
    <SearchableDropdown<ProductDropdownItem>
      items={dropdownItems}
      loading={isLoading}
      placeholder={placeholder}
      emptyMessage={
        isLoading ? undefined : "Aucun produit dans le catalogue"
      }
      showCount
      onSelect={handleSelect}
      triggerValue={currentValue}
      triggerPlaceholder={placeholder}
      disabled={disabled}
      className={className}
      filterFn={filterFn as any}
    />
  );
};

export default ProductSuggestions;
