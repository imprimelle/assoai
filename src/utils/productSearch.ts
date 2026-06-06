// productSearch.ts — Moteur de recherche intelligent pour le catalogue produits
// Gère : accent-insensibilité, réordonnancement des mots, dimensions, prix, score de pertinence

import type { Product, ProductVariant } from "@/types/product";

// ──────────────────────────────────────────────
// NORMALISATION
// ──────────────────────────────────────────────

/** Supprime les accents et normalise en minuscules */
export function normalizeText(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // enlève les diacritiques
    .replace(/\s+/g, " ")
    .trim();
}

/** Découpe en tokens uniques (mots individuels) */
export function tokenize(str: string): string[] {
  return [...new Set(normalizeText(str).split(/\s+/).filter(Boolean))];
}

// ──────────────────────────────────────────────
// DÉTECTION D'INDICES
// ──────────────────────────────────────────────

interface DimensionHint {
  valueCm: number; // toujours converti en cm
  unit: string;
}

/** Détecte les indices de dimension : 2m, 200cm, 200 cm, 2 m, 2 metres, etc. */
export function detectDimensions(text: string): DimensionHint[] {
  const normalized = normalizeText(text);
  const hints: DimensionHint[] = [];

  // Patterns: nombre suivi d'une unité
  const patterns = [
    /(\d+[.,]?\d*)\s*(m|metres?|mètre)/g,
    /(\d+[.,]?\d*)\s*(cm|centimetres?|centimètre)/g,
    /(\d+[.,]?\d*)\s*(mm|millimetres?|millimètre)/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(normalized)) !== null) {
      let value = parseFloat(match[1].replace(",", "."));
      const unit = match[2];

      // Convertir en cm
      if (unit.startsWith("m") && !unit.startsWith("mm")) {
        value *= 100; // m → cm
      } else if (unit.startsWith("mm")) {
        value /= 10; // mm → cm
      }
      // cm → inchangé

      hints.push({ valueCm: Math.round(value), unit });
    }
  }

  return hints;
}

interface PriceHint {
  operator: "lt" | "gt" | "eq" | "around";
  value: number;
}

/** Détecte les indices de prix : <50000, moins de 50000, pas cher, etc. */
export function detectPriceHints(text: string): PriceHint[] {
  const normalized = normalizeText(text);
  const hints: PriceHint[] = [];

  // "moins de X", "pas plus de X", "< X", "max X"
  const ltPatterns = [
    /(?:moins\s+(?:de|d'))\s*(\d[\d\s]*)/i,
    /(?:pas\s+plus\s+(?:de|d'))\s*(\d[\d\s]*)/i,
    /(?:max(?:imum)?\s+)\s*(\d[\d\s]*)/i,
    /<\s*(\d[\d\s]*)/,
    /(?:pas\s+cher)/i, // pas cher = flag
    /(?:economique|abordable|bon\s+marche)/i,
  ];

  for (const pattern of ltPatterns) {
    const match = normalized.match(pattern);
    if (match) {
      if (match[1]) {
        hints.push({ operator: "lt", value: parseInt(match[1].replace(/\s/g, "")) });
      } else {
        hints.push({ operator: "lt", value: 50000 }); // "pas cher" ≈ <50000 FCFA
      }
    }
  }

  // "plus de X", "> X", "min X"
  const gtPatterns = [
    /(?:plus\s+(?:de|d'))\s*(\d[\d\s]*)/i,
    /(?:min(?:imum)?\s+)\s*(\d[\d\s]*)/i,
    /(?:au\s+moins)\s*(\d[\d\s]*)/i,
    />\s*(\d[\d\s]*)/,
    /(?:haut\s+de\s+gamme|premium|luxe)/i,
  ];

  for (const pattern of gtPatterns) {
    const match = normalized.match(pattern);
    if (match) {
      if (match[1]) {
        hints.push({ operator: "gt", value: parseInt(match[1].replace(/\s/g, "")) });
      } else {
        hints.push({ operator: "gt", value: 100000 });
      }
    }
  }

  // "environ X", "~X", "autour de X"
  const aroundPattern = /(?:environ|autour\s+de|~\s*)\s*(\d[\d\s]*)/i;
  const aroundMatch = normalized.match(aroundPattern);
  if (aroundMatch) {
    hints.push({ operator: "around", value: parseInt(aroundMatch[1].replace(/\s/g, "")) });
  }

  return hints;
}

// ──────────────────────────────────────────────
// SCORING
// ──────────────────────────────────────────────

export interface ScoredProduct {
  product: Product;
  score: number;
  matchedVariant?: ProductVariant;           // meilleure variante (backward compat)
  allMatchedVariants: ProductVariant[];      // toutes les variantes qui matchent
  matchDetails: string[];
}

/** Fraction de caractères de a trouvés dans b (dans l'ordre). Pour le fuzzy matching. */
function charOverlap(a: string, b: string): number {
  if (!a || !b) return 0;
  let matches = 0;
  let pos = 0;
  for (const ch of a) {
    const idx = b.indexOf(ch, pos);
    if (idx >= 0) { matches++; pos = idx + 1; }
  }
  return matches / a.length;
}

/** Extrait les mots-clés d'un texte pour l'expansion sémantique */
function extractKeywords(text: string): string[] {
  // Mots significatifs (≥3 lettres) après normalisation, sans ponctuation, sans stop words
  const stopWords = new Set(["les","des","est","pas","que","qui","une","sur","avec","pour","par","dans","aux","ces"]);
  return tokenize(text)
    .map(t => t.replace(/[.,;:!?()]$/, ""))
    .filter(t => t.length >= 3 && !stopWords.has(t));
}

/** Calcule l'overlap de mots-clés entre deux ensembles */
function keywordOverlap(a: Set<string>, b: Set<string>): number {
  let common = 0;
  for (const k of a) { if (b.has(k)) common++; }
  return a.size > 0 ? common / a.size : 0;
}

const MIN_SCORE = 2;        // score minimum pour apparaitre (abaissé pour plus de suggestions)
const MAX_RESULTS = 15;     // max de suggestions affichées
const EXPANSION_BOOST = 8;  // bonus de similarité pour produits apparentés

/**
 * Recherche intelligente dans le catalogue.
 * Score sur 100 : nom (40) + description (20) + tokens (20) + dimensions (10) + prix (10)
 * + expansion par mots-clés partagés
 */
export function smartSearch(query: string, products: Product[]): ScoredProduct[] {
  if (!query || !query.trim()) {
    return products.map(p => ({ product: p, score: 0, allMatchedVariants: [], matchDetails: [] }));
  }

  const normalizedQuery = normalizeText(query);
  const queryTokens = tokenize(query);
  const queryKeywords = extractKeywords(query);
  const dimHints = detectDimensions(query);
  const priceHints = detectPriceHints(query);

  const scored: ScoredProduct[] = [];

  for (const product of products) {
    let score = 0;
    const matchDetails: string[] = [];
    let bestVariant: ProductVariant | undefined;
    const allMatchedVariants: ProductVariant[] = [];

    const normName = normalizeText(product.name);
    const normDesc = normalizeText(product.description || "");
    const nameTokens = tokenize(product.name);
    const descTokens = tokenize(product.description || "");

    // ── 1. Match nom (0-40 pts) ──
    if (normName === normalizedQuery) {
      score += 40;
      matchDetails.push("nom exact");
    } else if (normName.includes(normalizedQuery)) {
      score += 30;
      matchDetails.push("nom contient");
    } else {
      let nameTokenMatches = 0;
      for (const qt of queryTokens) {
        if (normName.includes(qt)) nameTokenMatches++;
      }
      if (nameTokenMatches > 0) {
        score += (nameTokenMatches / queryTokens.length) * 25;
        matchDetails.push(`nom:${nameTokenMatches}/${queryTokens.length}`);
      } else {
        // Fuzzy : chevauchement de caractères pour tokens courts
        for (const qt of queryTokens) {
          if (qt.length >= 3 && charOverlap(qt, normName) >= 0.75) {
            score += 8;
            matchDetails.push(`nom≈${qt}`);
            break;
          }
        }
      }
    }

    // ── 2. Match description (0-20 pts, standalone) ──
    if (normDesc) {
      if (normDesc.includes(normalizedQuery)) {
        score += 20;
        matchDetails.push("desc contient");
      } else {
        let descMatches = 0;
        for (const qt of queryTokens) {
          if (normDesc.includes(qt)) descMatches++;
        }
        if (descMatches > 0) {
          score += (descMatches / queryTokens.length) * 15;
          matchDetails.push(`desc:${descMatches}/${queryTokens.length}`);
        }
      }
    }

    // ── 3. Match variantes (0-20 pts sur le score max) ──
    if (product.variants && Array.isArray(product.variants)) {
      let bestVariantScore = 0;
      for (const variant of product.variants) {
        const normVariantName = normalizeText(variant.name);
        let variantScore = 0;

        if (normVariantName === normalizedQuery) {
          variantScore = 20;
        } else if (normVariantName.includes(normalizedQuery)) {
          variantScore = 15;
        } else {
          let vTokenMatch = 0;
          for (const qt of queryTokens) {
            if (normVariantName.includes(qt)) vTokenMatch++;
          }
          if (vTokenMatch > 0) {
            variantScore = (vTokenMatch / queryTokens.length) * 10;
          }
        }

        if (variantScore > 0) {
          allMatchedVariants.push(variant);
          if (variantScore > bestVariantScore) {
            bestVariantScore = variantScore;
            bestVariant = variant;
          }
          matchDetails.push(`variante:${variant.name}`);
        }
      }
      if (bestVariantScore > 0) score += bestVariantScore;
    }

    // ── 4. Bonus dimensions (0-10 pts) ──
    if (dimHints.length > 0 && normDesc) {
      let dimMatches = 0;
      for (const hint of dimHints) {
        const dimPattern = new RegExp(
          `(?:${hint.valueCm - 5})\\s*cm|(?:${hint.valueCm})\\s*cm|(?:${hint.valueCm + 5})\\s*cm|` +
          `${Math.round(hint.valueCm / 100)}[.,]?\\d*\\s*m`,
          "i"
        );
        if (dimPattern.test(normDesc)) dimMatches++;
        if (dimPattern.test(normName)) dimMatches++;
      }
      if (dimMatches > 0) {
        score += Math.min(10, dimMatches * 5);
        matchDetails.push(`dim:${dimMatches}`);
      }
    }

    // ── 5. Bonus prix (0-10 pts) ──
    if (priceHints.length > 0) {
      const productPrice = bestVariant?.price || (product.variants?.[0]?.price ?? 0);
      if (productPrice > 0) {
        for (const hint of priceHints) {
          switch (hint.operator) {
            case "lt":
              if (productPrice <= hint.value) { score += 10; matchDetails.push(`prix≤${hint.value}`); }
              else if (productPrice <= hint.value * 1.2) { score += 5; matchDetails.push(`prix~≤${hint.value}`); }
              break;
            case "gt":
              if (productPrice >= hint.value) { score += 10; matchDetails.push(`prix≥${hint.value}`); }
              break;
            case "around":
              const diff = Math.abs(productPrice - hint.value) / hint.value;
              if (diff <= 0.1) { score += 10; matchDetails.push(`prix≈${hint.value}`); }
              else if (diff <= 0.3) { score += 5; matchDetails.push(`prix~${hint.value}`); }
              break;
          }
        }
      }
    }

    // ── 6. Floor fuzzy : si rien ne matche, tenter description fuzzy ──
    if (score === 0 && normDesc) {
      for (const qt of queryTokens) {
        if (qt.length >= 3 && charOverlap(qt, normDesc) >= 0.5) {
          score = 2;
          matchDetails.push(`desc≈${qt}`);
          break;
        }
      }
    }

    if (score >= MIN_SCORE) {
      scored.push({ product, score, matchedVariant: bestVariant, allMatchedVariants, matchDetails });
    }
  }

  // ── 7. Expansion par mots-clés partagés ──
  // Pour chaque produit déjà retenu, booste les produits similaires
  const keywordSets = new Map<string, Set<string>>(); // product.id → keywords
  for (const p of products) {
    keywordSets.set(p.id, new Set(extractKeywords(p.name + " " + (p.description || ""))));
  }

  const boostMap = new Map<string, number>(); // product.id → bonus score
  for (const s of scored) {
    const myKeywords = keywordSets.get(s.product.id)!;
    if (myKeywords.size === 0) continue;
    
    for (const p of products) {
      if (p.id === s.product.id) continue;
      const theirKeywords = keywordSets.get(p.id)!;
      const overlap = keywordOverlap(myKeywords, theirKeywords);
      if (overlap >= 0.25) {
        const boost = Math.round(EXPANSION_BOOST * overlap);
        boostMap.set(p.id, Math.max(boostMap.get(p.id) || 0, boost));
      }
    }
  }

  // Appliquer les boosts aux produits non encore scorés
  for (const p of products) {
    const boost = boostMap.get(p.id) || 0;
    if (boost > 0 && !scored.some(s => s.product.id === p.id)) {
      scored.push({
        product: p,
        score: boost,
        allMatchedVariants: [],
        matchDetails: [`apparenté (boost ${boost})`],
      });
    }
  }

  // Trier par score décroissant
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, MAX_RESULTS);
}

/**
 * Version simplifiée pour remplacer le filtre actuel de ProductSuggestions.
 * Retourne juste les produits filtrés (sans scoring détaillé).
 */
export function quickSearch(query: string, products: Product[]): Product[] {
  const results = smartSearch(query, products);
  return results.map(r => r.product);
}
