import React from 'react';
import {
  Edit,
  Trash2,
  Eye,
  Info,
  Settings,
  FileText,
  Tag,
  Layers,
  Wrench,
} from 'lucide-react';
import { Product } from '@/types/product';
import { formatCFA } from '@/utils/format';

interface ProductCardProps {
  product: Product;
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
  onView: (product: Product) => void;
  viewMode: 'catalog' | 'fabrication';
}

const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onEdit,
  onDelete,
  onView,
  viewMode,
}) => {
  const hasVariants =
    Array.isArray(product.variants) && product.variants.length > 0;
  const lowestPrice = hasVariants
    ? Math.min(...product.variants.map((v) => v.price || 0))
    : 0;
  const hasManufacturingRules =
    product.manufacturing_rules?.description_complete?.trim()?.length > 0;
  const hasExamples =
    product.manufacturing_rules?.exemples?.trim()?.length > 0;

  // ─── VUE CATALOGUE ────────────────────────────────────
  if (viewMode === 'catalog') {
    return (
      <div className="group relative flex flex-col rounded-2xl overflow-hidden bg-white border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
        {/* Image */}
        <div className="relative h-44 overflow-hidden bg-gray-50">
          {product.main_image_url ? (
            <img
              src={product.main_image_url}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300">
              <Info className="h-10 w-10 opacity-30" />
            </div>
          )}

          {/* Badge nombre de variantes */}
          {hasVariants && (
            <div className="absolute top-3 right-3">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-white/90 backdrop-blur-sm text-gray-700 shadow-sm">
                <Layers className="h-3 w-3" />
                {product.variants.length}
              </span>
            </div>
          )}

          {/* Badge règles dispo */}
          {hasManufacturingRules && (
            <div className="absolute top-3 left-3">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-brand-orange/10 text-brand-orange">
                <Wrench className="h-3 w-3" />
                Règles
              </span>
            </div>
          )}
        </div>

        {/* Contenu */}
        <div className="flex flex-col flex-1 p-4">
          {/* Nom */}
          <h3 className="font-semibold text-gray-800 text-sm leading-tight line-clamp-2 group-hover:text-brand-orange transition-colors">
            {product.name}
          </h3>

          {/* Description */}
          {product.description && (
            <p className="text-xs text-gray-400 mt-1.5 line-clamp-2 leading-relaxed">
              {product.description}
            </p>
          )}

          {/* Prix */}
          <div className="mt-auto pt-3">
            {hasVariants ? (
              <div>
                <div className="text-lg font-bold text-brand-orange leading-none">
                  {formatCFA(lowestPrice)}
                </div>
                {product.variants.length > 1 && (
                  <span className="text-[11px] text-gray-400">
                    à partir de
                  </span>
                )}
              </div>
            ) : (
              <span className="text-sm text-gray-400 italic">
                Prix non défini
              </span>
            )}

            {/* Variantes en mini-tags */}
            {hasVariants && product.variants.length <= 5 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {product.variants.map((v) => (
                  <span
                    key={v.id}
                    className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-gray-100 text-gray-600"
                  >
                    {v.name}
                  </span>
                ))}
              </div>
            )}
            {hasVariants && product.variants.length > 5 && (
              <p className="text-[10px] text-gray-400 mt-1">
                +{product.variants.length} variantes
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-50 bg-gray-50/50">
          <button
            onClick={() => onView(product)}
            className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-brand-orange transition-colors"
          >
            <Eye className="h-3.5 w-3.5" />
            Détails
          </button>

          <div className="flex items-center gap-0.5">
            <button
              onClick={() => onEdit(product)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-brand-orange hover:bg-brand-orange/5 transition-colors"
              title="Modifier"
            >
              <Edit className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onDelete(product.id)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Supprimer"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── VUE FABRICATION ─────────────────────────────────
  return (
    <div className="group relative flex flex-col rounded-2xl overflow-hidden bg-white border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
      {/* En-tête */}
      <div className="flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100/50">
        <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-blue-100 text-blue-600">
          <Settings className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-sm text-gray-800 truncate">
            {product.name}
          </h3>
          <p className="text-[11px] text-gray-400">Règles de fabrication</p>
        </div>
      </div>

      {/* Contenu */}
      <div className="flex flex-col flex-1 p-4">
        {/* Règles de fabrication */}
        {hasManufacturingRules ? (
          <div className="flex-1">
            <div className="flex items-center gap-1.5 mb-2">
              <FileText className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Procédé
              </span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed line-clamp-5 font-mono">
              {product.manufacturing_rules!.description_complete}
            </p>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xs text-gray-300 italic">
              Aucune règle de fabrication
            </p>
          </div>
        )}

        {/* Badges */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-50">
          {hasManufacturingRules && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-blue-50 text-blue-600">
              <Wrench className="h-3 w-3" />
              Règles documentées
            </span>
          )}
          {hasExamples && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-amber-50 text-amber-600">
              <Tag className="h-3 w-3" />
              Exemples CDC
            </span>
          )}
          {!hasManufacturingRules && !hasExamples && (
            <span className="text-[10px] text-gray-300 italic">
              Non documenté
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-50 bg-gray-50/50">
        <button
          onClick={() => onView(product)}
          className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-blue-600 transition-colors"
        >
          <Eye className="h-3.5 w-3.5" />
          Détails
        </button>

        <div className="flex items-center gap-0.5">
          <button
            onClick={() => onEdit(product)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            title="Modifier"
          >
            <Edit className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDelete(product.id)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Supprimer"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
