// src/lib/shelfPacker.ts
// Algorithme MaxRects bin packing pour le groupage CDC Builder.
// Place N plaques sur K feuilles avec rotation optionnelle.
// Remplace l'ancien shelf packing guillotine — MaxRects est un algorithme
// libre (pas de contrainte de coupes guillotine) qui trouve de meilleurs
// placements, surtout quand les plaques ont des hauteurs différentes.
//
// Référence : Jukka Jylänki, "A Thousand Ways to Pack the Bin"
// Heuristique : Best Short Side Fit (BSSF)

export interface PlaqueInput {
  id: string;
  largeur: number;   // mètres
  hauteur: number;   // mètres
  nom: string;
  quantite: number;  // nombre d'exemplaires identiques
}

export interface Placement2D {
  enfant_id: string;
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
  rotated: boolean;
  nom: string;
}

export interface Chute2D {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

export interface FeuilleResult {
  placements: Placement2D[];
  chutes: Chute2D[];
}

export interface PackResult {
  sheets: FeuilleResult[];
  unplaced: PlaqueInput[];
}

interface FreeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const EPSILON = 0.0001;

/** Compare deux nombres flottants avec tolérance */
function feq(a: number, b: number): boolean {
  return Math.abs(a - b) < EPSILON;
}

/**
 * Place les plaques sur des feuilles avec l'algorithme MaxRects.
 *
 * Stratégie :
 * 1. Trier les plaques par plus grande dimension décroissante
 * 2. Pour chaque plaque, évaluer tous les free rectangles × orientations
 * 3. Choisir le placement qui minimise le « short side waste » (BSSF)
 * 4. Mettre à jour la liste des free rectangles après chaque placement
 * 5. Si aucune place, passer à la feuille suivante
 *
 * @param plaques - Liste des plaques à placer
 * @param feuilleL - Largeur d'une feuille en mètres
 * @param feuilleH - Hauteur d'une feuille en mètres
 * @param allowRotation - Autoriser la rotation à 90° (default: true)
 * @returns Résultat du packing avec feuilles et plaques non placées
 */
export function shelfPack(
  plaques: PlaqueInput[],
  feuilleL: number,
  feuilleH: number,
  allowRotation: boolean = true,
): PackResult {
  if (plaques.length === 0) {
    return { sheets: [], unplaced: [] };
  }

  if (feuilleL <= 0 || feuilleH <= 0) {
    return { sheets: [], unplaced: plaques };
  }

  // Déplier les quantités : chaque exemplaire devient une plaque distincte
  const expanded: PlaqueInput[] = [];
  for (const p of plaques) {
    const q = Math.max(1, Math.round(p.quantite || 1));
    for (let i = 0; i < q; i++) {
      expanded.push({
        ...p,
        id: q > 1 ? `${p.id}-${i}` : p.id,
        quantite: 1,
      });
    }
  }

  // Tri par plus grande dimension décroissante (max(w,h) puis min(w,h))
  const sorted = [...expanded].sort((a, b) => {
    const aMax = Math.max(a.largeur, a.hauteur);
    const bMax = Math.max(b.largeur, b.hauteur);
    if (!feq(aMax, bMax)) return bMax - aMax;
    const aMin = Math.min(a.largeur, a.hauteur);
    const bMin = Math.min(b.largeur, b.hauteur);
    return bMin - aMin;
  });

  const sheets: FeuilleResult[] = [];
  const unplaced: PlaqueInput[] = [];
  let remaining = sorted;

  // Dimensions max de la feuille pour validation
  const feuilleMax = Math.max(feuilleL, feuilleH);
  const feuilleMin = Math.min(feuilleL, feuilleH);

  while (remaining.length > 0) {
    const freeRects: FreeRect[] = [{ x: 0, y: 0, w: feuilleL, h: feuilleH }];
    const placements: Placement2D[] = [];
    const stillRemaining: PlaqueInput[] = [];

    for (const plaque of remaining) {
      // Vérifier que la plaque peut tenir sur la feuille
      const pMax = Math.max(plaque.largeur, plaque.hauteur);
      const pMin = Math.min(plaque.largeur, plaque.hauteur);
      if (pMax > feuilleMax || pMin > feuilleMin) {
        unplaced.push(plaque);
        continue;
      }

      // Générer les orientations
      const orientations: Array<{ w: number; h: number; rotated: boolean }> = [
        { w: plaque.largeur, h: plaque.hauteur, rotated: false },
      ];
      if (allowRotation && !feq(plaque.largeur, plaque.hauteur)) {
        orientations.push({ w: plaque.hauteur, h: plaque.largeur, rotated: true });
      }

      // Évaluer tous les free rects × orientations → BSSF
      let bestScore = Infinity;
      let bestX = 0;
      let bestY = 0;
      let bestW = 0;
      let bestH = 0;
      let bestRotated = false;
      let bestFreeIdx = -1;

      for (const orient of orientations) {
        for (let fi = 0; fi < freeRects.length; fi++) {
          const fr = freeRects[fi];
          if (orient.w <= fr.w + EPSILON && orient.h <= fr.h + EPSILON) {
            // Best Short Side Fit : minimiser le gaspillage sur le petit côté
            const leftoverW = fr.w - orient.w;
            const leftoverH = fr.h - orient.h;
            const score = Math.min(leftoverW, leftoverH);
            if (score < bestScore) {
              bestScore = score;
              bestX = fr.x;
              bestY = fr.y;
              bestW = orient.w;
              bestH = orient.h;
              bestRotated = orient.rotated;
              bestFreeIdx = fi;
            }
          }
        }
      }

      if (bestFreeIdx < 0) {
        // Aucun free rect ne peut accueillir cette plaque
        stillRemaining.push(plaque);
        continue;
      }

      // Placer la plaque
      placements.push({
        enfant_id: plaque.id,
        x: bestX,
        y: bestY,
        largeur: bestW,
        hauteur: bestH,
        rotated: bestRotated,
        nom: plaque.nom,
      });

      const oldFr = freeRects[bestFreeIdx];

      // Mise à jour des free rects
      const newFree: FreeRect[] = [];

      for (const fr of freeRects) {
        // Supprimer le rectangle utilisé
        if (feq(fr.x, oldFr.x) && feq(fr.y, oldFr.y) && feq(fr.w, oldFr.w) && feq(fr.h, oldFr.h)) {
          continue;
        }
        // Supprimer les rectangles entièrement couverts par le placement
        if (
          fr.x >= bestX - EPSILON &&
          fr.y >= bestY - EPSILON &&
          fr.x + fr.w <= bestX + bestW + EPSILON &&
          fr.y + fr.h <= bestY + bestH + EPSILON
        ) {
          continue;
        }
        newFree.push(fr);
      }

      // Split : partie droite du rectangle utilisé
      // ⚠️ Hauteur = bestH (pas oldFr.h !) — sinon chevauchement avec le split haut
      const rightW = oldFr.x + oldFr.w - (bestX + bestW);
      if (rightW > EPSILON) {
        newFree.push({ x: bestX + bestW, y: oldFr.y, w: rightW, h: bestH });
      }

      // Split : partie haute du rectangle utilisé
      const topH = oldFr.y + oldFr.h - (bestY + bestH);
      if (topH > EPSILON) {
        newFree.push({ x: oldFr.x, y: bestY + bestH, w: oldFr.w, h: topH });
      }

      // Nettoyer : supprimer les rectangles contenus dans d'autres
      const clean: FreeRect[] = [];
      for (let i = 0; i < newFree.length; i++) {
        const r = newFree[i];
        let contained = false;
        for (let j = 0; j < newFree.length; j++) {
          if (i === j) continue;
          const r2 = newFree[j];
          if (
            r.x >= r2.x - EPSILON &&
            r.y >= r2.y - EPSILON &&
            r.x + r.w <= r2.x + r2.w + EPSILON &&
            r.y + r.h <= r2.y + r2.h + EPSILON
          ) {
            contained = true;
            break;
          }
        }
        if (!contained && r.w > EPSILON && r.h > EPSILON) {
          clean.push(r);
        }
      }

      freeRects.length = 0;
      freeRects.push(...clean);
    }

    if (placements.length === 0) {
      // Aucune plaque placée → les restantes sont unplacées
      for (const p of stillRemaining) {
        unplaced.push(p);
      }
      break;
    }

    // Chutes = free rects restants après placement
    const chutes: Chute2D[] = freeRects
      .filter((fr) => fr.w > 0.001 && fr.h > 0.001)
      .map((fr) => ({
        x: fr.x,
        y: fr.y,
        largeur: fr.w,
        hauteur: fr.h,
      }));

    sheets.push({ placements, chutes });
    remaining = stillRemaining;
  }

  return { sheets, unplaced };
}

/**
 * Calcule les statistiques d'un résultat de packing.
 */
export function packStats(
  result: PackResult,
  feuilleL: number,
  feuilleH: number,
): {
  nbFeuilles: number;
  surfaceTotale: number;
  surfaceUtilisee: number;
  surfaceChute: number;
  ratioUtilisation: number;
  nbUnplaced: number;
} {
  const feuilleSurface = feuilleL * feuilleH;
  const nbFeuilles = result.sheets.length;
  const surfaceTotale = nbFeuilles * feuilleSurface;

  let surfaceUtilisee = 0;
  for (const sheet of result.sheets) {
    for (const p of sheet.placements) {
      surfaceUtilisee += p.largeur * p.hauteur;
    }
  }

  const surfaceChute = Math.max(0, surfaceTotale - surfaceUtilisee);
  const ratioUtilisation =
    surfaceTotale > 0 ? surfaceUtilisee / surfaceTotale : 0;

  return {
    nbFeuilles,
    surfaceTotale: Math.round(surfaceTotale * 100) / 100,
    surfaceUtilisee: Math.round(surfaceUtilisee * 100) / 100,
    surfaceChute: Math.round(surfaceChute * 100) / 100,
    ratioUtilisation: Math.round(ratioUtilisation * 100) / 100,
    nbUnplaced: result.unplaced.length,
  };
}
