// src/constants/materials.ts
// Listes canoniques partagées pour l'édition des matériaux (CDC).
// Objectif : remplacer les valeurs codées en dur / saisies libres incohérentes
// dans MaterialCard, et servir de fallback quand un matériau n'est pas lié au catalogue.

/** Unités standard proposées (combobox — la saisie libre reste possible). */
export const UNITES = [
  "plaque",
  "m²",
  "mètre",
  "ml",
  "unité",
  "lot",
  "barre",
  "rouleau",
  "kg",
  "tube",
  "feuille",
  "panneau",
] as const;

/** Couleurs standard (dédupliquées, casse normalisée). */
export const COULEURS = [
  "Transparent",
  "Blanc",
  "Blanc chaud",
  "Noir",
  "Rouge",
  "Bleu",
  "Blue ice",
  "Jaune",
  "Vert",
  "Violet",
  "Orange",
  "Rose",
  "Marron",
  "Doré",
] as const;

/** Épaisseurs standard — valeur === label (corrige le bug value="1mm"/label="3 mm"). */
export const EPAISSEURS = [
  "3mm",
  "5mm",
  "8mm",
  "10mm",
  "18mm",
] as const;

export type Unite = (typeof UNITES)[number];
export type Couleur = (typeof COULEURS)[number];
export type Epaisseur = (typeof EPAISSEURS)[number];

/**
 * Retourne la liste d'options en garantissant la présence de la valeur courante
 * (évite toute perte de donnée sur les CDC déjà remplis avec des valeurs non standard).
 */
export function withCurrent(
  options: readonly string[],
  current?: string,
): string[] {
  if (current && !options.includes(current)) {
    return [current, ...options];
  }
  return [...options];
}
