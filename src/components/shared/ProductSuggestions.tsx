
import React, { useState, useEffect } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Search, Package, Tag, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Product, ProductVariant } from "@/types/product";
import { useProducts } from "@/hooks/useProducts";
import { formatCFA } from "@/utils/format";

interface ProductSuggestionItem {
  id: string;
  name: string;
  price: number;
  isVariant: boolean;
  parentProduct?: string;
  imageUrl?: string | null;
}

interface ProductSuggestionsProps {
  onSelectProduct: (product: { description: string; prixUnitaire: number; image_url?: string | null }) => void;
  currentValue?: string;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

const ProductSuggestions: React.FC<ProductSuggestionsProps> = ({
  onSelectProduct,
  currentValue = "",
  disabled = false,
  className = "",
  placeholder = "Rechercher un produit..."
}) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { products, isLoading } = useProducts("", "ALL");
  const [suggestions, setSuggestions] = useState<ProductSuggestionItem[]>([]);

  // Process products data to include both products and variants
  useEffect(() => {
    const processProducts = () => {
      try {
        const items: ProductSuggestionItem[] = [];
        
        if (!Array.isArray(products)) {
          setSuggestions([]);
          return;
        }
        
        products.forEach(product => {
          if (!product) return;
          // Add main product
          items.push({
            id: product.id,
            name: product.name || "Sans nom",
            price: (product.variants && Array.isArray(product.variants) && product.variants[0]?.price) || 0,
            isVariant: false,
            imageUrl: product.main_image_url
          });
          
          // Add variants if any
          if (Array.isArray(product.variants)) {
            product.variants.forEach(variant => {
              if (!variant) return;
              items.push({
                id: variant.id || '',
                name: variant.name || 'Variante',
                price: variant.price || 0,
                isVariant: true,
                parentProduct: product.name,
                imageUrl: variant.image_url || product.main_image_url
              });
            });
          }
        });
        
        setSuggestions(items);
      } catch (err) {
        console.error("ProductSuggestions error:", err);
        setSuggestions([]);
      }
    };
    
    processProducts();
  }, [products]);

  // Filter suggestions based on search term
  const filteredSuggestions = suggestions.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.parentProduct && item.parentProduct.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <Popover open={open && !disabled} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between text-left font-normal",
            !currentValue && "text-muted-foreground",
            className
          )}
          onClick={() => setOpen(!open)}
          disabled={disabled}
        >
          {currentValue || placeholder}
          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandInput 
            placeholder={placeholder} 
            className="h-9" 
            value={searchTerm}
            onValueChange={setSearchTerm}
          />
          <CommandList>
            <CommandEmpty>
              {isLoading ? "Chargement..." : "Aucun produit trouvé"}
            </CommandEmpty>
            <CommandGroup heading="Produits">
              {filteredSuggestions.filter(item => !item.isVariant).map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.name}
                  onSelect={() => {
                    onSelectProduct({
                      description: item.name,
                      prixUnitaire: item.price,
                      image_url: item.imageUrl || undefined
                    });
                    setOpen(false);
                    setSearchTerm("");
                  }}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center">
                    <Package className="mr-2 h-4 w-4 text-gray-500" />
                    <div className="flex flex-col">
                      <span className="font-medium">{item.name}</span>
                      <span className="text-xs text-gray-500">
                        {formatCFA(item.price)}
                      </span>
                    </div>
                  </div>
                  {currentValue === item.name && (
                    <Check className="h-4 w-4 text-green-500" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
            
            {filteredSuggestions.some(item => item.isVariant) && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Variantes">
                  {filteredSuggestions.filter(item => item.isVariant).map((item) => (
                    <CommandItem
                      key={item.id}
                      value={item.name}
                      onSelect={() => {
                        onSelectProduct({
                          description: item.parentProduct ? `${item.parentProduct} - ${item.name}` : item.name,
                          prixUnitaire: item.price,
                          image_url: item.imageUrl || undefined
                        });
                        setOpen(false);
                        setSearchTerm("");
                      }}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center">
                        <Tag className="mr-2 h-4 w-4 text-gray-500" />
                        <div className="flex flex-col">
                          <span className="font-medium">{item.name}</span>
                          <span className="text-xs text-gray-500">
                            {item.parentProduct && `${item.parentProduct} • `}
                            {formatCFA(item.price)}
                          </span>
                        </div>
                      </div>
                      {currentValue === item.name && (
                        <Check className="h-4 w-4 text-green-500" />
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default ProductSuggestions;
