
import React from 'react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Eye, ShoppingCart, Info } from 'lucide-react';
import { Product } from '@/types/product';
import { formatCFA } from '@/utils/format';

interface ProductCardProps {
  product: Product;
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
  onView: (product: Product) => void;
  viewMode?: 'grid' | 'list';
}

const ProductCard: React.FC<ProductCardProps> = ({ 
  product, 
  onEdit, 
  onDelete, 
  onView,
  viewMode = 'grid' 
}) => {
  const hasVariants = product.variants && product.variants.length > 0;
  const lowestPrice = hasVariants
    ? Math.min(...product.variants.map(v => v.price))
    : 0;
  
  // Price formatting using formatCFA
  const formattedPrice = hasVariants
    ? `${formatCFA(lowestPrice)}${product.variants.length > 1 ? ' et plus' : ''}`
    : 'Prix non disponible';

  // Deletion confirmation
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const handleDeleteClick = () => {
    if (confirmDelete) {
      onDelete(product.id);
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
      // Reset after 3 seconds
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  // List view display - optimized for compact display
  if (viewMode === 'list') {
    return (
      <div className="bg-white border-b py-2 px-3 hover:bg-gray-50 transition-colors">
        <div className="flex items-center justify-between">
          {/* Left section: Product name and badges */}
          <div className="flex-grow max-w-[40%] mr-2">
            <h3 className="text-sm font-medium text-gray-800 truncate">{product.name}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                {product.variants.length} var.
              </span>
              
              {product.manufacturing_rules && product.manufacturing_rules.length > 0 && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">
                  {product.manufacturing_rules.length} règle{product.manufacturing_rules.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
          
          {/* Middle section: optional description, trimmed */}
          <div className="hidden md:block flex-grow max-w-[30%] px-2">
            <p className="text-xs text-gray-500 truncate">{product.description}</p>
          </div>
          
          {/* Right section: Price + Actions */}
          <div className="flex items-center">
            <div className="text-sm font-bold text-brand-orange whitespace-nowrap mr-3">
              {formattedPrice}
            </div>
            
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onView(product)}
                className="h-7 w-7 hover:bg-gray-100"
              >
                <Eye className="h-3.5 w-3.5" />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onEdit(product)}
                className="h-7 w-7 hover:bg-gray-100"
              >
                <Edit className="h-3.5 w-3.5" />
              </Button>
              
              <Button
                variant={confirmDelete ? "destructive" : "ghost"}
                size="icon"
                onClick={handleDeleteClick}
                className={`h-7 w-7 ${confirmDelete ? "animate-pulse" : "hover:bg-red-50 hover:text-red-500"}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Grid view display (default) - unchanged
  return (
    <Card className="h-full flex flex-col overflow-hidden transition-all hover:shadow-md hover:translate-y-[-2px] bg-white border border-gray-200">
      <CardHeader className="p-0 h-48 overflow-hidden relative group">
        {product.main_image_url ? (
          <img
            src={product.main_image_url}
            alt={product.name}
            className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500"
          />
        ) : (
          <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400">
            <Info className="h-8 w-8 opacity-40" />
          </div>
        )}
        
        {/* Badge for variant count */}
        <div className="absolute top-2 right-2">
          <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-white/90 backdrop-blur-sm text-gray-800 shadow-sm">
            {product.variants.length} {product.variants.length > 1 ? 'variantes' : 'variante'}
          </span>
        </div>
      </CardHeader>
      
      <CardContent className="flex-grow p-4">
        <h3 className="font-semibold text-lg line-clamp-1 text-gray-800 group-hover:text-brand-orange transition-colors">{product.name}</h3>
        <p className="text-sm text-gray-500 mt-1 line-clamp-2">{product.description}</p>
        <div className="mt-4 text-lg font-bold text-brand-orange">
          {formattedPrice}
        </div>
      </CardContent>
      
      <CardFooter className="px-4 pb-4 pt-0 flex justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onView(product)}
          className="flex items-center gap-1"
        >
          <Eye className="h-4 w-4" />
          <span>Détails</span>
        </Button>
        
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(product)}
            className="h-8 w-8 hover:bg-gray-100 hover:text-brand-orange"
          >
            <Edit className="h-4 w-4" />
          </Button>
          
          <Button
            variant={confirmDelete ? "destructive" : "ghost"}
            size="icon"
            onClick={handleDeleteClick}
            className={`h-8 w-8 ${confirmDelete ? "animate-pulse" : "hover:bg-red-50 hover:text-red-500"}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default ProductCard;
