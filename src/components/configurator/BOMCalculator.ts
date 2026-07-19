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

  // Scanner les formules
  for (const item of bomItems) {
    if (!item.formule) continue;
    for (const sym of ["P", "d"]) {
      if (new RegExp(`\\b${sym}\\b`).test(item.formule)) {
        if (!found.has(sym) && VARIABLE_DEFS[sym]) {
          found.set(sym, { ...VARIABLE_DEFS[sym], value: VARIABLE_DEFS[sym].min + (VARIABLE_DEFS[sym].max - VARIABLE_DEFS[sym].min) / 2 });
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
  materials: Map<string, MaterialCatalogEntry> = new Map()
): BomCalculation[] {
  const L = variables.get("L") ?? 1;
  const H = variables.get("H") ?? 1;

  // Calculer les alias une seule fois
  const aliases: Record<string, number> = {
    S: L * H,
    PER: 2 * (L + H),
  };

  return bomItems.map((item) => {
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

        // Évaluer avec expr-eval (sandbox sécurisé)
        quantite = Parser.evaluate(expr);
      } catch {
        // Si l'évaluation échoue, on garde la quantité fixe ou 1
        quantite = item.quantite_fixe ?? 1;
        formuleUtilisee = null; // marquer comme non évaluée
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
