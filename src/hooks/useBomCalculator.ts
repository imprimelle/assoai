// src/hooks/useBomCalculator.ts
// Hook réactif — charge la BOM, extrait les variables, calcule en temps réel.

import { useState, useEffect, useMemo, useCallback } from "react";
import { useProductBom } from "@/hooks/useProductBom";
import { useMaterials } from "@/hooks/useMaterials";
import {
  extractVariables,
  calculateBom,
  variablesToRecord,
  totalCost,
  type BomVariable,
  type BomCalculation,
} from "@/components/configurator/BOMCalculator";
import type { ProductBomItem } from "@/types/productBom";
import type { MaterialCatalogEntry } from "@/types/materialCatalog";

interface UseBomCalculatorReturn {
  /** Variables extraites de la BOM (pour les sliders). */
  variables: BomVariable[];
  /** Résultats du calcul (quantités, coûts). */
  calculations: BomCalculation[];
  /** Coût total estimé. */
  totalCostEstimate: number | null;
  /** Met à jour la valeur d'une variable. */
  setVariable: (symbol: string, value: number) => void;
  /** Valeurs actuelles des variables {L: 0.6, H: 0.6, ...}. */
  variableValues: Record<string, number>;
  /** La BOM est-elle chargée ? */
  isLoading: boolean;
  /** La BOM a-t-elle des items ? */
  hasBom: boolean;
}

/**
 * Hook réactif qui connecte la BOM d'un produit au moteur de calcul.
 *
 * Usage :
 * ```tsx
 * const { variables, calculations, setVariable, hasBom } = useBomCalculator(productId);
 * ```
 */
export function useBomCalculator(productId?: string): UseBomCalculatorReturn {
  const { items: bomItems, isLoading: bomLoading } = useProductBom(productId);
  const { materials } = useMaterials();

  // Extraire les variables une fois
  const variables = useMemo(() => extractVariables(bomItems), [bomItems]);

  // Initialiser les valeurs à partir des variables extraites
  const [values, setValues] = useState<Record<string, number>>({});

  // Réinitialiser quand la BOM change
  useEffect(() => {
    setValues(variablesToRecord(variables));
  }, [variables]);

  // Index des matériaux par ID
  const materialIndex = useMemo(() => {
    const map = new Map<string, MaterialCatalogEntry>();
    for (const m of materials) map.set(m.id, m);
    return map;
  }, [materials]);

  // Variable Map pour le calcul
  const variableMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const [k, v] of Object.entries(values)) map.set(k, v);
    return map;
  }, [values]);

  // Calculer les quantités (réactif à chaque changement de variable)
  const calculations = useMemo(
    () => calculateBom(bomItems, variableMap, materialIndex),
    [bomItems, variableMap, materialIndex]
  );

  const totalCostEstimate = useMemo(() => totalCost(calculations), [calculations]);

  // Setter pour une variable
  const setVariable = useCallback((symbol: string, value: number) => {
    setValues((prev) => ({ ...prev, [symbol]: value }));
  }, []);

  return {
    variables,
    calculations,
    totalCostEstimate,
    setVariable,
    variableValues: values,
    isLoading: bomLoading,
    hasBom: bomItems.length > 0,
  };
}
