// src/components/configurator/BOMCalculator.ts
// Moteur de calcul — lit la BOM, extrait les variables, évalue les formules.
// 100% piloté par la base de données, 0 hardcoding.

import { Parser } from "expr-eval";
import type { ProductBomItem } from "@/types/productBom";
import type { MaterialCatalogEntry } from "@/types/materialCatalog";

// ============================================================
// TYPES
// ============================================================

/** Variable extraite des formules BOM — un slider à afficher. */
export interface BomVariable {
  symbol: string;
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
}

/** Une ligne calculée — matériau + quantité + coût. */
export interface BomCalculation {
  section: string;
  material_name: string;
  material_id: string | null;
  formule: string | null;
  quantite_fixe: number | null;
  unite: string;
  quantite_calculee: number;
  cout_unitaire: number | null;
  cout_total: number | null;
}

// ============================================================
// CONFIGURATION DES VARIABLES CONNUES
// ============================================================

const VARIABLE_DEFS: Record<string, Omit<BomVariable, "value">> = {
  L: { symbol: "L", label: "Largeur", unit: "m", min: 0.2, max: 6.0, step: 0.01 },
  H: { symbol: "H", label: "Hauteur", unit: "m", min: 0.2, max: 4.0, step: 0.01 },
  l: { symbol: "l", label: "Largeur second.", unit: "m", min: 0.2, max: 4.0, step: 0.01 },
  P: { symbol: "P", label: "Profondeur", unit: "m", min: 0.03, max: 0.5, step: 0.01 },
  d: { symbol: "d", label: "Diamètre", unit: "m", min: 0.3, max: 2.0, step: 0.01 },
};

// ============================================================
// EXTRACTION DES VARIABLES
// ============================================================

/**
 * Scanne les formules de la BOM pour détecter les variables libres.
 * L et H sont toujours inclus (dimensions de base de toute enseigne).
 */
export function extractVariables(bomItems: ProductBomItem[]): BomVariable[] {
  const found = new Map<string, BomVariable>();

  // Toujours inclure L et H
  for (const sym of ["L", "H"]) {
    if (VARIABLE_DEFS[sym]) {
      found.set(sym, { ...VARIABLE_DEFS[sym], value: 1.0 });
    }
  }

  // Scanner les formules ET conditions pour toutes les variables uppercase standalone
  const aliasSet = new Set(["S", "PER", "PI", "E"]);
  for (const item of bomItems) {
    const texts = [item.formule, item.condition_expr].filter(Boolean) as string[];
    for (const text of texts) {
      const matches = text.match(/\b([A-Z][A-Za-z0-9_]*)\b/g) || [];
      for (const sym of matches) {
        if (aliasSet.has(sym)) continue; // alias, pas une variable
        if (!found.has(sym) && VARIABLE_DEFS[sym]) {
          found.set(sym, {
            ...VARIABLE_DEFS[sym],
            value: VARIABLE_DEFS[sym].min + (VARIABLE_DEFS[sym].max - VARIABLE_DEFS[sym].min) / 2,
          });
        }
      }
    }
  }

  // Scanner les meta_variables
  for (const item of bomItems) {
    if (item.meta_variables) {
      for (const [key, defaultVal] of Object.entries(item.meta_variables)) {
        if (!found.has(key)) {
          found.set(key, {
            symbol: key,
            label: key.replace(/_/g, " "),
            value: typeof defaultVal === "number" ? defaultVal : 0,
            unit: "",
            min: 0,
            max: 100,
            step: 1,
          });
        }
      }
    }
  }

  return Array.from(found.values());
}

// ============================================================
// ÉVALUATION DES FORMULES
// ============================================================

/**
 * Calcule les quantités pour tous les items BOM.
 *
 * @param bomItems - Items de la table product_bom
 * @param variables - Map des variables {L: 0.6, H: 0.6, ...}
 * @param materials - Map des matériaux par ID (pour les prix)
 */
export function calculateBom(
  bomItems: ProductBomItem[],
  variables: Map<string, number>,
  materials: Map<string, MaterialCatalogEntry> = new Map(),
  profileChoices?: Record<string, string>,
  metaValues?: Record<string, any>
): BomCalculation[] {
  const L = variables.get("L") ?? 1;
  const H = variables.get("H") ?? 1;

  // Calculer les alias une seule fois
  const aliases: Record<string, number> = {
    S: variables.has("l") ? (variables.get("L") ?? 1) * (variables.get("l") ?? 1) : L * H,
    PER: 2 * (L + H),
  };

  // Contexte d'évaluation (variables + alias + metaValues)
  const evalContext: Record<string, number> = {};
  for (const [k, v] of variables) evalContext[k] = v;
  for (const [k, v] of Object.entries(aliases)) evalContext[k] = v;
  if (metaValues) {
    for (const [k, v] of Object.entries(metaValues)) {
      evalContext[k] = typeof v === "number" ? v : (typeof v === "boolean" ? (v ? 1 : 0) : 0);
    }
  }

  // Filtrer par profil et condition
  const filteredItems = bomItems.filter((item) => {
    // Filtre profil
    if (item.profile_group && item.profile_value && profileChoices) {
      const choice = profileChoices[item.profile_group];
      if (choice !== undefined && choice !== item.profile_value) return false;
    }
    // Filtre condition
    if (item.condition_expr) {
      try {
        const result = Parser.evaluate(item.condition_expr, evalContext);
        if (!result) return false;
      } catch {
        return false;
      }
    }
    return true;
  });

  return filteredItems.map((item) => {
    let quantite = item.quantite_fixe ?? 1;
    let formuleUtilisee = item.formule;

    if (item.formule) {
      try {
        // Remplacer les alias S et PER
        let expr = item.formule;
        for (const [alias, val] of Object.entries(aliases)) {
          expr = expr.replace(new RegExp(`\\b${alias}\\b`, "g"), String(val));
        }

        // Remplacer les variables
        for (const [sym, val] of variables) {
          expr = expr.replace(new RegExp(`\\b${sym}\\b`, "g"), String(val));
        }

        // Injecter les metaValues
        if (metaValues) {
          for (const [k, v] of Object.entries(metaValues)) {
            if (typeof v === "number" || typeof v === "boolean") {
              expr = expr.replace(new RegExp(`\\b${k}\\b`, "g"), String(typeof v === "boolean" ? (v ? 1 : 0) : v));
            }
          }
        }

        // Évaluer avec expr-eval (sandbox sécurisé)
        quantite = Parser.evaluate(expr);
      } catch {
        quantite = item.quantite_fixe ?? 1;
        formuleUtilisee = null;
      }
    }

    // Arrondir à 2 décimales
    quantite = Math.round(quantite * 100) / 100;

    // Prix depuis le catalogue
    const mat = item.material_id ? materials.get(item.material_id) : undefined;
    const coutUnitaire = mat?.cout_min ?? null;
    const coutTotal = coutUnitaire != null ? quantite * coutUnitaire : null;

    return {
      section: item.section,
      material_name: item.material_name,
      material_id: item.material_id ?? null,
      formule: formuleUtilisee,
      quantite_fixe: item.quantite_fixe ?? null,
      unite: item.unite,
      quantite_calculee: quantite,
      cout_unitaire: coutUnitaire,
      cout_total: coutTotal,
    };
  });
}

// ============================================================
// HELPERS
// ============================================================

/** Calcule le coût total estimé. */
export function totalCost(calcs: BomCalculation[]): number | null {
  const costs = calcs.map((c) => c.cout_total).filter((c): c is number => c != null);
  if (costs.length === 0) return null;
  return Math.round(costs.reduce((a, b) => a + b, 0));
}

/** Convertit une Map<string, number> en Record pour le state React. */
export function variablesToRecord(vars: BomVariable[]): Record<string, number> {
  const rec: Record<string, number> = {};
  for (const v of vars) rec[v.symbol] = v.value;
  return rec;
}
