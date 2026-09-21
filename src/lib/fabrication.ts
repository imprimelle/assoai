// src/lib/fabrication.ts
// Évaluation du stock : quels produits (tables verre/bois, tableaux) sont fabriquables
// à partir des sections disponibles. Matching par nature + dimensions (tolérance 0,5 cm,
// insensible à l'orientation), en priorité tables en verre → tables en bois → tableaux.

import type { StockSheet, StockSection } from "@/types/stock";

export type ProductType = "table_verre" | "table_bois" | "tableau";

export interface FabricationProduct {
  type: ProductType;
  sections: StockSection[];
}

export interface FabricationResult {
  products: FabricationProduct[];
  leftover: StockSection[];
  counts: Record<ProductType, number>;
}

const TOL = 0.5;
const eq = (a: number, b: number) => Math.abs(a - b) <= TOL;

/** Vrai si la section a les dimensions (w,h), dans un sens ou l'autre. */
function rectMatches(s: StockSection, w: number, h: number): boolean {
  return (
    (eq(s.largeur, w) && eq(s.hauteur, h)) ||
    (eq(s.largeur, h) && eq(s.hauteur, w))
  );
}

/** Sections "disponibles" (feuilles de matière) : découpé ou raboté, en récursant les "divisé". */
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

export function evaluateFabrication(sheets: StockSheet[]): FabricationResult {
  const pool = collectAvailableSections(sheets);
  const used = new Set<string>();
  const products: FabricationProduct[] = [];

  const unused = () => pool.filter((s) => !used.has(s.id));

  // ── Pass 1 : tables en verre (5 vitres + 1 miroir) ──────────
  let progressed = true;
  while (progressed) {
    progressed = false;
    const vitres = unused().filter((s) => s.nature === "vitre");

    outer: for (const plateau of vitres) {
      const orientations: [number, number][] = [
        [plateau.largeur, plateau.hauteur],
        [plateau.hauteur, plateau.largeur],
      ];
      for (const [l, L] of orientations) {
        const miroir = unused().find(
          (s) => s.nature === "miroir" && rectMatches(s, l - 2, L - 2),
        );
        if (!miroir) continue;

        const others = unused().filter(
          (s) => s.nature === "vitre" && s.id !== plateau.id,
        );
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

  // ── Pass 2 : tables en bois (1 vitre + 1 miroir, même dims) ─
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

  // ── Pass 3 : tableaux (1 plexi + 1 miroir 2 cm plus petit) ──
  for (const plexi of unused().filter((s) => s.nature === "plexiglass")) {
    const miroir = unused().find(
      (s) =>
        s.nature === "miroir" &&
        ((eq(s.largeur, plexi.largeur - 2) && eq(s.hauteur, plexi.hauteur - 2)) ||
          (eq(s.largeur, plexi.hauteur - 2) && eq(s.hauteur, plexi.largeur - 2))),
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

  return { products, leftover: unused(), counts };
}
