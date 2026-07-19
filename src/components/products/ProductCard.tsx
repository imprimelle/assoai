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
  ShoppingBag,
} from 'lucide-react';
import { Product } from '@/types/product';
import { formatCFA } from '@/utils/format';
import { motion } from 'framer-motion';
import { useProductBom } from '@/hooks/useProductBom';
import { Package } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
  onView: (product: Product) => void;
  viewMode: 'catalog' | 'fabrication';
  index?: number;
}

const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onEdit,
  onDelete,
  onView,
  viewMode,
  index = 0,
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

  // 🆕 BOM count
  const { items: bomItems } = useProductBom(product.id);
  const bomCount = bomItems.length;

  const cardAnimation = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.4, delay: index * 0.05, ease: [0.25, 0.4, 0.25, 1] },
    },
  };

  // ─── VUE CATALOGUE ────────────────────────────────────
  if (viewMode === 'catalog') {
    return (
      <motion.div
        variants={cardAnimation}
        initial="hidden"
        animate="visible"
        className="group relative flex flex-col rounded-3xl overflow-hidden bg-white/70 backdrop-blur-sm border border-white/80 shadow-[0_2px_20px_-6px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_40px_-10px_rgba(249,115,22,0.15)] hover:-translate-y-1.5 hover:bg-white/90 transition-all duration-500 ease-out"
      >
        {/* Image */}
        <div className="relative h-44 overflow-hidden bg-gradient-to-br from-orange-50 to-amber-50">
          {product.main_image_url ? (
            <img
              src={product.main_image_url}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ShoppingBag className="h-12 w-12 text-orange-200/60" />
            </div>
          )}

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

          {/* Badge nombre de variantes */}
          {hasVariants && (
            <div className="absolute top-3 right-3">
              <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold bg-white/90 backdrop-blur-md text-gray-700 shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
                <Layers className="h-3 w-3" />
                {product.variants.length}
              </span>
            </div>
          )}

          {/* 🆕 Badge BOM */}
          {bomCount > 0 && (
            <div className={`absolute top-3 ${hasVariants ? 'right-16' : 'right-3'}`}>
              <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold bg-green-500/90 backdrop-blur-md text-white shadow-[0_2px_8px_rgba(34,197,94,0.3)]">
                <Package className="h-3 w-3" />
                {bomCount}
              </span>
            </div>
          )}

          {/* Badge règles */}
          {hasManufacturingRules && (
            <div className="absolute top-3 left-3">
              <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold bg-orange-500/90 backdrop-blur-md text-white shadow-[0_2px_8px_rgba(249,115,22,0.3)]">
                <Wrench className="h-3 w-3" />
              </span>
            </div>
          )}
        </div>

        {/* Contenu */}
        <div className="flex flex-col flex-1 p-4">
          {/* Nom */}
          <h3 className="font-semibold text-gray-800 text-sm leading-tight line-clamp-2 group-hover:text-orange-600 transition-colors duration-300">
            {product.name}
          </h3>

          {/* Description */}
          {product.description && (
            <p className="text-xs text-gray-400 mt-1.5 line-clamp-2 leading-relaxed">
              {product.description}
            </p>
          )}

          {/* Prix */}
          <div className="mt-auto pt-4">
            {hasVariants ? (
              <div>
                <div className="text-xl font-bold bg-gradient-to-r from-orange-600 to-amber-500 bg-clip-text text-transparent leading-none">
                  {formatCFA(lowestPrice)}
                </div>
                {product.variants.length > 1 && (
                  <span className="text-[10px] text-gray-400 font-medium">
                    à partir de
                  </span>
                )}
              </div>
            ) : (
              <span className="text-xs text-orange-300 italic font-medium">
                Prix non défini
              </span>
            )}

            {/* Variantes en mini-tags */}
            {hasVariants && product.variants.length <= 5 && (
              <div className="flex flex-wrap gap-1 mt-2.5">
                {product.variants.map((v) => (
                  <span
                    key={v.id}
                    className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-medium bg-orange-50 text-orange-700 border border-orange-100"
                  >
                    {v.name}
                  </span>
                ))}
              </div>
            )}
            {hasVariants && product.variants.length > 5 && (
              <p className="text-[10px] text-gray-400 mt-1.5 font-medium">
                +{product.variants.length} variantes
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-orange-50 bg-gradient-to-r from-orange-50/50 to-transparent">
          <button
            onClick={() => onView(product)}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-orange-600 transition-colors duration-200"
          >
            <Eye className="h-3.5 w-3.5" />
            Détails
          </button>

          <div className="flex items-center gap-1">
            <button
              onClick={() => onEdit(product)}
              className="p-2 rounded-xl text-gray-400 hover:text-orange-600 hover:bg-orange-50 transition-all duration-200"
              title="Modifier"
            >
              <Edit className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onDelete(product.id)}
              className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all duration-200"
              title="Supprimer"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  // ─── VUE FABRICATION ─────────────────────────────────
  return (
    <motion.div
      variants={cardAnimation}
      initial="hidden"
      animate="visible"
      className="group relative flex flex-col rounded-3xl overflow-hidden bg-white/70 backdrop-blur-sm border border-white/80 shadow-[0_2px_20px_-6px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_40px_-10px_rgba(59,130,246,0.12)] hover:-translate-y-1.5 hover:bg-white/90 transition-all duration-500 ease-out"
    >
      {/* En-tête avec image */}
      <div className="relative h-36 overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-50">
        {product.main_image_url ? (
          <img
            src={product.main_image_url}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Settings className="h-12 w-12 text-blue-200/60" />
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-blue-900/30 via-transparent to-transparent opacity-40 group-hover:opacity-60 transition-opacity duration-500" />

        {/* Badge règles */}
        {hasManufacturingRules && (
          <div className="absolute top-3 left-3">
            <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold bg-blue-500/90 backdrop-blur-md text-white shadow-[0_2px_8px_rgba(59,130,246,0.3)]">
              <Wrench className="h-3 w-3" />
            </span>
          </div>
        )}

        {/* 🆕 Badge BOM */}
        {bomCount > 0 && (
          <div className="absolute top-3 right-3">
            <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold bg-green-500/90 backdrop-blur-md text-white shadow-[0_2px_8px_rgba(34,197,94,0.3)]">
              <Package className="h-3 w-3" />
              {bomCount}
            </span>
          </div>
        )}

        {/* Nom superposé */}
        <div className="absolute bottom-0 left-0 right-0 px-4 py-3 bg-gradient-to-t from-black/60 via-black/30 to-transparent">
          <h3 className="font-semibold text-sm text-white truncate">
            {product.name}
          </h3>
          <p className="text-[10px] text-blue-200 font-medium">Règles de fabrication</p>
        </div>
      </div>

      {/* Contenu */}
      <div className="flex flex-col flex-1 p-4">
        {hasManufacturingRules ? (
          <div className="flex-1">
            <div className="flex items-center gap-1.5 mb-2.5">
              <FileText className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                Procédé
              </span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed line-clamp-5 font-mono bg-blue-50/30 rounded-xl p-3 border border-blue-100/30">
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
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-blue-100/70 text-blue-700">
              <Wrench className="h-3 w-3" />
              Documenté
            </span>
          )}
          {hasExamples && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-amber-100/70 text-amber-700">
              <Tag className="h-3 w-3" />
              Exemples
            </span>
          )}
          {!hasManufacturingRules && !hasExamples && (
            <span className="text-[10px] text-gray-300 italic">Non documenté</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-blue-50 bg-gradient-to-r from-blue-50/50 to-transparent">
        <button
          onClick={() => onView(product)}
          className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-blue-600 transition-colors duration-200"
        >
          <Eye className="h-3.5 w-3.5" />
          Détails
        </button>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(product)}
            className="p-2 rounded-xl text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all duration-200"
            title="Modifier"
          >
            <Edit className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDelete(product.id)}
            className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all duration-200"
            title="Supprimer"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default ProductCard;
