// src/lib/shelfPacker.ts
// Algorithme guillotine shelf packing pour le groupage CDC Builder.
// Place N plaques sur K feuilles avec rotation optionnelle.
// Retourne les placements 2D + zones de chute pour l'aperçu visuel.

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

interface Shelf {
  y: number;
  height: number;
  x_cursor: number;
}

/**
 * Place les plaques sur des feuilles avec un algorithme guillotine shelf.
 * 
 * Stratégie :
 * 1. Trier les plaques par surface décroissante
 * 2. Pour chaque plaque, essayer de la placer dans une shelf existante
 * 3. Si aucune shelf ne convient, créer une nouvelle shelf
 * 4. Si plus d'espace vertical, passer à la feuille suivante
 * 5. Si la plaque est trop grande (même avec rotation), la mettre dans unplaced
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

  // Trier par surface décroissante (priorité aux plus grandes)
  const sorted = [...expanded].sort((a, b) => {
    const areaB = b.largeur * b.hauteur;
    const areaA = a.largeur * a.hauteur;
    return areaB - areaA;
  });

  const sheets: FeuilleResult[] = [];
  const unplaced: PlaqueInput[] = [];
  let remaining = sorted;

  // Dimensions max de la feuille pour validation
  const feuilleMax = Math.max(feuilleL, feuilleH);
  const feuilleMin = Math.min(feuilleL, feuilleH);

  while (remaining.length > 0) {
    const shelves: Shelf[] = [];
    const placements: Placement2D[] = [];
    const stillRemaining: PlaqueInput[] = [];

    for (const plaque of remaining) {
      let placed = false;

      // Vérifier que la plaque peut tenir sur la feuille (même avec rotation)
      const pMax = Math.max(plaque.largeur, plaque.hauteur);
      const pMin = Math.min(plaque.largeur, plaque.hauteur);
      if (pMax > feuilleMax || pMin > feuilleMin) {
        // Plaque trop grande dans les deux dimensions
        unplaced.push(plaque);
        continue;
      }

      // Essayer les deux orientations (originale + rotation)
      const orientations: Array<{ w: number; h: number; rotated: boolean }> = [
        { w: plaque.largeur, h: plaque.hauteur, rotated: false },
      ];
      if (allowRotation && plaque.largeur !== plaque.hauteur) {
        orientations.push({ w: plaque.hauteur, h: plaque.largeur, rotated: true });
      }

      for (const orient of orientations) {
        // 1. Chercher une shelf existante
        for (const shelf of shelves) {
          const remainingWidth = feuilleL - shelf.x_cursor;
          // Vérifier largeur ET hauteur : la plaque ne doit pas dépasser la shelf
          if (orient.w <= remainingWidth && orient.h <= shelf.height) {
            placements.push({
              enfant_id: plaque.id,
              x: shelf.x_cursor,
              y: shelf.y,
              largeur: orient.w,
              hauteur: orient.h,
              rotated: orient.rotated,
              nom: plaque.nom,
            });
            shelf.x_cursor += orient.w;
            placed = true;
            break;
          }
        }

        if (placed) break;

        // 2. Créer une nouvelle shelf
        const usedHeight = shelves.reduce((sum, s) => sum + s.height, 0);
        const remainingHeight = feuilleH - usedHeight;

        if (orient.h <= remainingHeight) {
          const newShelf: Shelf = {
            y: usedHeight,
            height: orient.h,
            x_cursor: 0,
          };
          placements.push({
            enfant_id: plaque.id,
            x: 0,
            y: usedHeight,
            largeur: orient.w,
            hauteur: orient.h,
            rotated: orient.rotated,
            nom: plaque.nom,
          });
          newShelf.x_cursor = orient.w;
          shelves.push(newShelf);
          placed = true;
          break;
        }
      }

      if (!placed) {
        stillRemaining.push(plaque);
      }
    }

    // Calculer les zones de chute pour cette feuille
    const chutes = computeChutes(feuilleL, feuilleH, shelves);

    if (placements.length === 0) {
      // Aucune plaque n'a pu être placée sur cette feuille
      // → les plaques restantes ne rentrent pas (problème de dimensions)
      // On les ajoute à unplaced sauf si on boucle
      for (const p of stillRemaining) {
        unplaced.push(p);
      }
      break;
    }

    sheets.push({ placements, chutes });
    remaining = stillRemaining;
  }

  return { sheets, unplaced };
}

/**
 * Calcule les zones de chute rectangulaires après placement.
 * Approche simple : chute à droite de chaque shelf + chute en bas après la dernière shelf.
 */
function computeChutes(feuilleL: number, feuilleH: number, shelves: Shelf[]): Chute2D[] {
  const chutes: Chute2D[] = [];

  if (shelves.length === 0) return chutes;

  // Chutes à droite de chaque shelf
  for (const shelf of shelves) {
    const remainingWidth = feuilleL - shelf.x_cursor;
    if (remainingWidth > 0.001) {
      chutes.push({
        x: shelf.x_cursor,
        y: shelf.y,
        largeur: remainingWidth,
        hauteur: shelf.height,
      });
    }
  }

  // Chute en bas (après la dernière shelf)
  const lastShelf = shelves[shelves.length - 1];
  const bottomY = lastShelf.y + lastShelf.height;
  const remainingBottom = feuilleH - bottomY;
  if (remainingBottom > 0.001) {
    chutes.push({
      x: 0,
      y: bottomY,
      largeur: feuilleL,
      hauteur: remainingBottom,
    });
  }

  return chutes;
}

/**
 * Calcule les statistiques d'un résultat de packing.
 * Utile pour le footer d'aperçu.
 */
export function packStats(result: PackResult, feuilleL: number, feuilleH: number): {
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
  const ratioUtilisation = surfaceTotale > 0 ? surfaceUtilisee / surfaceTotale : 0;

  return {
    nbFeuilles,
    surfaceTotale: Math.round(surfaceTotale * 100) / 100,
    surfaceUtilisee: Math.round(surfaceUtilisee * 100) / 100,
    surfaceChute: Math.round(surfaceChute * 100) / 100,
    ratioUtilisation: Math.round(ratioUtilisation * 100) / 100,
    nbUnplaced: result.unplaced.length,
  };
}
