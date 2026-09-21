// src/lib/fabrication.ts
// Évaluation du stock : quels produits (tables verre/bois, tableaux) sont fabriquables
// à partir des sections disponibles + diagnostic des produits quasi-complets.
//
// Matching par nature + dimensions (tolérance 0,5 cm, insensible à l'orientation).
// Priorité : tables en verre → tables en bois → tableaux.
//
// Le miroir/panneau « 2 cm plus petit » admet une tolérance : entre 2 et 4 cm plus petit
// (SHRINK_MIN..SHRINK_MAX). Entre 0 et 2 cm plus petit → pièce « à recouper » (diagnostic).

import type { StockSheet, StockSection, StockNature } from "@/types/stock";

export type ProductType = "table_verre" | "table_bois" | "tableau";

export interface FabricationProduct {
  type: ProductType;
  sections: StockSection[];
}

export interface DiagnosticMissing {
  nom: string;
  nature: StockNature;
  largeur: number; // dimension requise (cm)
  hauteur: number;
}

export interface DiagnosticProblematic {
  section: StockSection; // pièce présente mais mal dimensionnée (à recouper)
  requiredLargeur: number; // dimension cible
  requiredHauteur: number;
}

export interface DiagnosticItem {
  type: ProductType;
  label: string;
  present: StockSection[];
  missing: DiagnosticMissing[];
  problematic: DiagnosticProblematic[];
}

export interface FabricationResult {
  products: FabricationProduct[];
  leftover: StockSection[];
  counts: Record<ProductType, number>;
  diagnostics: DiagnosticItem[];
}

const TOL = 0.5;
const SHRINK_MIN = 2; // miroir/panneau au moins 2 cm plus petit
const SHRINK_MAX = 4; // tolérance : jusqu'à 4 cm plus petit

const eq = (a: number, b: number) => Math.abs(a - b) <= TOL;

/** Vrai si la section a les dimensions (w,h), dans un sens ou l'autre. */
function rectMatches(s: StockSection, w: number, h: number): boolean {
  return (
    (eq(s.largeur, w) && eq(s.hauteur, h)) ||
    (eq(s.largeur, h) && eq(s.hauteur, w))
  );
}

/**
 * Vrai si la section est `minLess..maxLess` cm plus petite que (w,h) dans chaque
 * dimension, insensible à l'orientation (comparaison sur dims triées).
 */
function rectShrinkMatch(
  s: StockSection,
  w: number,
  h: number,
  minLess: number,
  maxLess: number,
): boolean {
  const sLo = Math.min(s.largeur, s.hauteur);
  const sHi = Math.max(s.largeur, s.hauteur);
  const tLo = Math.min(w, h);
  const tHi = Math.max(w, h);
  const dLo = tLo - sLo; // positif si la section est plus petite
  const dHi = tHi - sHi;
  return (
    dLo >= minLess - TOL && dLo <= maxLess + TOL && dHi >= minLess - TOL && dHi <= maxLess + TOL
  );
}

/** Sections "disponibles" : découpé ou raboté, en récursant les "divisé". */
export function collectAvailableSections(sheets: StockSheet[]): StockSection[] {
  const out: StockSection[] = [];
  const walk = (sections: StockSection[]) => {
    for (const s of sections) {
      if (s.statut === "utilise") continue;
      if (s.statut === "divise" && s.sub_sections && s.sub_sections.length > 0) {
        walk(s.sub_sections);
      } else if (s.statut === "decoupe" || s.statut === "rabote") {
        out.push(s);
      }
    }
  };
  for (const sh of sheets) walk(sh.sections);
  return out;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function evaluateFabrication(sheets: StockSheet[]): FabricationResult {
  const pool = collectAvailableSections(sheets);
  const used = new Set<string>();
  const products: FabricationProduct[] = [];

  const unused = () => pool.filter((s) => !used.has(s.id));

  // ── Pass 1 : tables en verre (5 vitres + 1 miroir 2-4 cm plus petit) ──
  let progressed = true;
  while (progressed) {
    progressed = false;
    const vitres = unused().filter((s) => s.nature === "vitre");

    outer: for (const plateau of vitres) {
      for (const [l, L] of [
        [plateau.largeur, plateau.hauteur],
        [plateau.hauteur, plateau.largeur],
      ] as [number, number][]) {
        const miroir = unused().find(
          (s) => s.nature === "miroir" && rectShrinkMatch(s, l, L, SHRINK_MIN, SHRINK_MAX),
        );
        if (!miroir) continue;

        const others = unused().filter((s) => s.nature === "vitre" && s.id !== plateau.id);
        const hCands = new Set<number>();
        for (const v of others) {
          if (eq(v.largeur, l)) hCands.add(v.hauteur);
          if (eq(v.hauteur, l)) hCands.add(v.largeur);
          if (eq(v.largeur, L)) hCands.add(v.hauteur);
          if (eq(v.hauteur, L)) hCands.add(v.largeur);
        }

        for (const h of hCands) {
          const cotes = others.filter((v) => rectMatches(v, l, h));
          const faces = others.filter((v) => rectMatches(v, L, h));
          if (cotes.length < 2 || faces.length < 2) continue;

          const chosenCotes = cotes.slice(0, 2);
          const chosenFaces = faces
            .filter((v) => !chosenCotes.some((c) => c.id === v.id))
            .slice(0, 2);
          if (chosenFaces.length < 2) continue;

          used.add(plateau.id);
          chosenCotes.forEach((v) => used.add(v.id));
          chosenFaces.forEach((v) => used.add(v.id));
          used.add(miroir.id);
          products.push({
            type: "table_verre",
            sections: [plateau, ...chosenCotes, ...chosenFaces, miroir],
          });
          progressed = true;
          break outer;
        }
      }
    }
  }

  // ── Pass 2 : tables en bois (1 vitre + 1 miroir, même dims) ──
  for (const vitre of unused().filter((s) => s.nature === "vitre")) {
    const miroir = unused().find(
      (s) => s.nature === "miroir" && rectMatches(s, vitre.largeur, vitre.hauteur),
    );
    if (miroir) {
      used.add(vitre.id);
      used.add(miroir.id);
      products.push({ type: "table_bois", sections: [vitre, miroir] });
    }
  }

  // ── Pass 3 : tableaux (1 plexi + 1 miroir 2-4 cm plus petit) ──
  for (const plexi of unused().filter((s) => s.nature === "plexiglass")) {
    const miroir = unused().find(
      (s) => s.nature === "miroir" && rectShrinkMatch(s, plexi.largeur, plexi.hauteur, SHRINK_MIN, SHRINK_MAX),
    );
    if (miroir) {
      used.add(plexi.id);
      used.add(miroir.id);
      products.push({ type: "tableau", sections: [plexi, miroir] });
    }
  }

  const counts: Record<ProductType, number> = {
    table_verre: 0,
    table_bois: 0,
    tableau: 0,
  };
  for (const p of products) counts[p.type]++;

  return {
    products,
    leftover: unused(),
    counts,
    diagnostics: diagnoseFabrication(sheets),
  };
}

/**
 * Diagnostic : produits quasi-complets. Pour chaque table en verre / tableau dont les
 * vitres/plexi sont présents mais dont le miroir est manquant ou « à recouper » (0-2 cm
 * plus petit au lieu de 2-4), on remonte l'élément problématique ou manquant.
 */
export function diagnoseFabrication(sheets: StockSheet[]): DiagnosticItem[] {
  const pool = collectAvailableSections(sheets);
  const used = new Set<string>();
  const diagnostics: DiagnosticItem[] = [];
  const unused = () => pool.filter((s) => !used.has(s.id));

  // ── Tables en verre quasi-complètes ──
  let progressed = true;
  while (progressed) {
    progressed = false;
    const vitres = unused().filter((s) => s.nature === "vitre");

    outer: for (const plateau of vitres) {
      for (const [l, L] of [
        [plateau.largeur, plateau.hauteur],
        [plateau.hauteur, plateau.largeur],
      ] as [number, number][]) {
        const others = unused().filter((s) => s.nature === "vitre" && s.id !== plateau.id);
        const hCands = new Set<number>();
        for (const v of others) {
          if (eq(v.largeur, l)) hCands.add(v.hauteur);
          if (eq(v.hauteur, l)) hCands.add(v.largeur);
          if (eq(v.largeur, L)) hCands.add(v.hauteur);
          if (eq(v.hauteur, L)) hCands.add(v.largeur);
        }

        for (const h of hCands) {
          const cotes = others.filter((v) => rectMatches(v, l, h));
          const faces = others.filter((v) => rectMatches(v, L, h));
          if (cotes.length < 2 || faces.length < 2) continue;

          const cc = cotes.slice(0, 2);
          const ff = faces.filter((v) => !cc.some((c) => c.id === v.id)).slice(0, 2);
          if (ff.length < 2) continue;

          const miroirs = unused().filter((s) => s.nature === "miroir");
          const valid = miroirs.find((s) => rectShrinkMatch(s, l, L, SHRINK_MIN, SHRINK_MAX));
          if (valid) {
            // complet → on le consomme (déjà couvert par evaluateFabrication)
            used.add(plateau.id);
            cc.forEach((v) => used.add(v.id));
            ff.forEach((v) => used.add(v.id));
            used.add(valid.id);
            progressed = true;
            break outer;
          }

          const trim = miroirs.find((s) => rectShrinkMatch(s, l, L, 0, SHRINK_MIN));
          used.add(plateau.id);
          cc.forEach((v) => used.add(v.id));
          ff.forEach((v) => used.add(v.id));
          if (trim) {
            used.add(trim.id);
            diagnostics.push({
              type: "table_verre",
              label: "Table en verre",
              present: [plateau, ...cc, ...ff],
              missing: [],
              problematic: [
                {
                  section: trim,
                  requiredLargeur: r2(l - SHRINK_MIN),
                  requiredHauteur: r2(L - SHRINK_MIN),
                },
              ],
            });
          } else {
            diagnostics.push({
              type: "table_verre",
              label: "Table en verre",
              present: [plateau, ...cc, ...ff],
              missing: [
                { nom: "Miroir", nature: "miroir", largeur: r2(l - SHRINK_MIN), hauteur: r2(L - SHRINK_MIN) },
              ],
              problematic: [],
            });
          }
          progressed = true;
          break outer;
        }
      }
    }
  }

  // ── Tableaux quasi-complets ──
  for (const plexi of unused().filter((s) => s.nature === "plexiglass")) {
    const miroirs = unused().filter((s) => s.nature === "miroir");
    const valid = miroirs.find((s) =>
      rectShrinkMatch(s, plexi.largeur, plexi.hauteur, SHRINK_MIN, SHRINK_MAX),
    );
    if (valid) {
      used.add(plexi.id);
      used.add(valid.id);
      continue;
    }
    const trim = miroirs.find((s) =>
      rectShrinkMatch(s, plexi.largeur, plexi.hauteur, 0, SHRINK_MIN),
    );
    used.add(plexi.id);
    if (trim) {
      used.add(trim.id);
      diagnostics.push({
        type: "tableau",
        label: "Tableau",
        present: [plexi],
        missing: [],
        problematic: [
          {
            section: trim,
            requiredLargeur: r2(plexi.largeur - SHRINK_MIN),
            requiredHauteur: r2(plexi.hauteur - SHRINK_MIN),
          },
        ],
      });
    } else {
      diagnostics.push({
        type: "tableau",
        label: "Tableau",
        present: [plexi],
        missing: [
          { nom: "Miroir", nature: "miroir", largeur: r2(plexi.largeur - SHRINK_MIN), hauteur: r2(plexi.hauteur - SHRINK_MIN) },
        ],
        problematic: [],
      });
    }
  }

  return diagnostics;
}
