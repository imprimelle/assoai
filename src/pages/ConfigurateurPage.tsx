// src/pages/ConfigurateurPage.tsx
// Page unifiée de configuration produit — remplace le simulateur mono-produit.
// Sélectionne un produit → charge sa BOM → rendu 3D + contrôles dynamiques + CDC.

import React, { useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Sparkles,
  Search,
  Check,
  FileSpreadsheet,
  Wrench,
  Package,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProducts } from "@/hooks/useProducts";
import { useBomCalculator } from "@/hooks/useBomCalculator";
import ConfiguratorEngine from "@/components/configurator/ConfiguratorEngine";
import DynamicControls from "@/components/configurator/controls/DynamicControls";
import MaterialPreview from "@/components/configurator/controls/MaterialPreview";
import type { Product } from "@/types/product";

// ============================================================
// COMPOSANT
// ============================================================
const ConfigurateurPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialProductId = searchParams.get("product") || undefined;

  const { products } = useProducts();

  // Sélection produit
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [showProductList, setShowProductList] = useState(false);

  // 🆕 BOM Calculator
  const {
    variables,
    calculations,
    totalCostEstimate,
    setVariable,
    variableValues,
    hasBom,
    isLoading: bomLoading,
  } = useBomCalculator(selectedProduct?.id);

  // Filtrer les produits
  const filteredProducts = useMemo(() => {
    if (!productSearch) return products.slice(0, 12);
    const q = productSearch.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 12);
  }, [products, productSearch]);

  // Générer CDC
  const handleGenerateCDC = () => {
    if (!selectedProduct) return;
    const cdcData = {
      product_id: selectedProduct.id,
      product_name: selectedProduct.name,
      dimensions: variableValues,
      materiaux_precalcules: hasBom
        ? calculations.map((c) => ({
            section: c.section,
            material_name: c.material_name,
            material_id: c.material_id,
            quantite: c.quantite_calculee,
            unite: c.unite,
            cout_unitaire: c.cout_unitaire,
            cout_total: c.cout_total,
          }))
        : [],
      total_estime: totalCostEstimate,
    };
    sessionStorage.setItem("configurateur_cdc", JSON.stringify(cdcData));
    navigate("/crm-templates?tab=commande");
  };

  // Rendu desktop : 3D à gauche, contrôles à droite
  return (
    <div className="flex flex-col h-screen bg-[#0a0a14] text-white">
      {/* ========== HEADER ========== */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-[#0f0f1a]/80 backdrop-blur-sm shrink-0 z-10">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-gray-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm hidden sm:inline">Retour</span>
        </button>
        <Wrench className="h-5 w-5 text-brand-orange" />
        <h1 className="text-lg font-semibold tracking-tight">Configurateur</h1>

        {/* Sélecteur produit */}
        <div className="ml-auto relative">
          <button
            onClick={() => setShowProductList(!showProductList)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm hover:bg-white/10 transition-colors"
          >
            <Package className="h-4 w-4 text-brand-orange" />
            <span className="truncate max-w-[200px]">
              {selectedProduct ? selectedProduct.name : "Choisir un produit"}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
          </button>

          {showProductList && (
            <div className="absolute right-0 top-full mt-1 w-80 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
              <div className="p-2">
                <div className="flex items-center gap-1.5 px-2 py-1.5 bg-white/5 rounded-lg mb-2">
                  <Search className="h-3.5 w-3.5 text-gray-500" />
                  <input
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Rechercher..."
                    className="bg-transparent text-white text-sm w-full outline-none placeholder:text-gray-500"
                    autoFocus
                  />
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedProduct(p);
                      setProductSearch("");
                      setShowProductList(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-brand-orange/10 flex items-center justify-between ${
                      p.id === selectedProduct?.id ? "bg-brand-orange/10" : ""
                    }`}
                  >
                    <span className="truncate">{p.name}</span>
                    {p.id === selectedProduct?.id && (
                      <Check className="h-4 w-4 text-brand-orange shrink-0 ml-2" />
                    )}
                  </button>
                ))}
                {filteredProducts.length === 0 && (
                  <p className="text-xs text-gray-500 text-center py-4">
                    Aucun produit trouvé
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========== CONTENU PRINCIPAL ========== */}
      {!selectedProduct ? (
        /* État vide */
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4">
          <Package className="h-16 w-16 text-gray-700" />
          <h2 className="text-xl font-semibold text-gray-300">
            Configurateur de produits
          </h2>
          <p className="text-sm text-gray-500 max-w-md">
            Sélectionnez un produit dans le catalogue pour visualiser et
            configurer ses dimensions. La nomenclature (BOM) sera chargée
            automatiquement.
          </p>
          <Button
            onClick={() => setShowProductList(true)}
            className="bg-brand-orange hover:bg-orange-600 text-white gap-2"
          >
            <Package className="h-4 w-4" />
            Choisir un produit
          </Button>
        </div>
      ) : (
        /* Vue configuration */
        <div className="flex-1 flex flex-col lg:flex-row min-h-0">
          {/* === 3D VIEWER === */}
          <div className="flex-1 relative min-h-[300px] lg:min-h-0">
            <ConfiguratorEngine
              productName={selectedProduct.name}
              rendererProps={{
                dimensions: {
                  L: variableValues.L ?? 1,
                  H: variableValues.H ?? 1,
                  P: variableValues.P,
                  d: variableValues.d,
                },
                options: {
                  facadeColor: "#e8e8f0",
                  showFrame: true,
                  frameMaterial: "metal",
                  imageUrl: selectedProduct.main_image_url || "",
                },
              }}
            />

            {/* Badge produit */}
            <div className="absolute top-3 left-3">
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-xs">
                <Package className="h-3 w-3 text-brand-orange" />
                <span className="text-white font-medium">
                  {selectedProduct.name}
                </span>
                {hasBom && (
                  <span className="text-gray-400">
                    · {calculations.length} matériaux
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* === SIDEBAR === */}
          <div className="w-full lg:w-80 xl:w-96 border-t lg:border-t-0 lg:border-l border-white/10 bg-[#0f0f1a]/60 backdrop-blur-sm overflow-y-auto shrink-0">
            <div className="p-4 space-y-5">
              {/* Dimensions */}
              {variables.length > 0 && (
                <DynamicControls
                  variables={variables}
                  values={variableValues}
                  onChange={setVariable}
                />
              )}

              {/* Matériaux */}
              {bomLoading ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  Chargement de la nomenclature...
                </div>
              ) : hasBom ? (
                <MaterialPreview
                  calculations={calculations}
                  totalCost={totalCostEstimate}
                />
              ) : (
                <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                  ⚠️ Ce produit n'a pas encore de nomenclature structurée. Le CDC
                  sera généré par Brico à partir des règles de fabrication.
                </p>
              )}

              {/* Générer CDC */}
              <Button
                onClick={handleGenerateCDC}
                disabled={!selectedProduct}
                className="w-full bg-brand-orange hover:bg-orange-600 text-white gap-2 h-11"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Générer un CDC
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========== FOOTER ========== */}
      {selectedProduct && (
        <div className="shrink-0 px-4 py-2 border-t border-white/10 bg-[#0f0f1a] flex items-center justify-between text-xs text-gray-500">
          <span>
            {selectedProduct.name}
            {hasBom && ` · BOM : ${calculations.length} items`}
          </span>
          <span>
            {variables.length > 0
              ? `${Object.entries(variableValues)
                  .map(([k, v]) => `${k}=${(v * 100).toFixed(0)}cm`)
                  .join(" · ")}`
              : ""}
          </span>
        </div>
      )}
    </div>
  );
};

export default ConfigurateurPage;
