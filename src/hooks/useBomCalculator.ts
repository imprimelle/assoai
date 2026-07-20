// src/hooks/useBomCalculator.ts
// Hook réactif — charge la BOM, extrait les variables, calcule en temps réel.
// v2 — supporte profileChoices et metaValues pour le filtrage conditionnel.

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

export interface ProfileGroupDef {
  group: string;
  values: string[];
}

export interface MetaVariableDef {
  key: string;
  label: string;
  type: "number" | "boolean" | "string";
  defaultValue: any;
}

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
  /** Items BOM bruts (pour extraire profils/meta). */
  bomItems: ProductBomItem[];
  /** Groupes de profils disponibles. */
  profileGroups: ProfileGroupDef[];
  /** Définitions des meta-variables. */
  metaVariableDefs: MetaVariableDef[];
}

/**
 * Hook réactif qui connecte la BOM d'un produit au moteur de calcul.
 *
 * Usage :
 * ```tsx
 * const { variables, calculations, setVariable, hasBom, profileGroups } =
 *   useBomCalculator(productId, profileChoices, metaValues);
 * ```
 */
export function useBomCalculator(
  productId?: string,
  profileChoices?: Record<string, string>,
  metaValues?: Record<string, any>
): UseBomCalculatorReturn {
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

  // Calculer les quantités (réactif à chaque changement)
  const calculations = useMemo(
    () => calculateBom(bomItems, variableMap, materialIndex, profileChoices, metaValues),
    [bomItems, variableMap, materialIndex, profileChoices, metaValues]
  );

  const totalCostEstimate = useMemo(() => totalCost(calculations), [calculations]);

  // Setter pour une variable
  const setVariable = useCallback((symbol: string, value: number) => {
    setValues((prev) => ({ ...prev, [symbol]: value }));
  }, []);

  // Extraire les groupes de profils
  const profileGroups = useMemo(() => {
    const groups = new Map<string, Set<string>>();
    for (const item of bomItems) {
      if (item.profile_group && item.profile_value) {
        if (!groups.has(item.profile_group)) groups.set(item.profile_group, new Set());
        groups.get(item.profile_group)!.add(item.profile_value);
      }
    }
    return Array.from(groups.entries()).map(([group, values]) => ({
      group,
      values: Array.from(values),
    }));
  }, [bomItems]);

  // Extraire les définitions de meta-variables
  const metaVariableDefs = useMemo(() => {
    const defs = new Map<string, MetaVariableDef>();
    for (const item of bomItems) {
      if (item.meta_variables) {
        for (const [key, defaultVal] of Object.entries(item.meta_variables)) {
          if (!defs.has(key)) {
            const type =
              typeof defaultVal === "boolean" ? "boolean" :
              typeof defaultVal === "number" ? "number" : "string";
            defs.set(key, {
              key,
              label: key.replace(/_/g, " "),
              type: type as "number" | "boolean" | "string",
              defaultValue: defaultVal,
            });
          }
        }
      }
    }
    return Array.from(defs.values());
  }, [bomItems]);

  return {
    variables,
    calculations,
    totalCostEstimate,
    setVariable,
    variableValues: values,
    isLoading: bomLoading,
    hasBom: bomItems.length > 0,
    bomItems,
    profileGroups,
    metaVariableDefs,
  };
}
