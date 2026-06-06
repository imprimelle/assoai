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
  matchedVariant?: ProductVariant;
  matchDetails: string[];
}

/**
 * Recherche intelligente dans le catalogue.
 * Score sur 100 : nom (40) + description (20) + tokens (20) + dimensions (10) + prix (10)
 */
export function smartSearch(query: string, products: Product[]): ScoredProduct[] {
  if (!query || !query.trim()) {
    return products.map(p => ({ product: p, score: 0, matchDetails: [] }));
  }

  const normalizedQuery = normalizeText(query);
  const queryTokens = tokenize(query);
  const dimHints = detectDimensions(query);
  const priceHints = detectPriceHints(query);

  const scored: ScoredProduct[] = [];

  for (const product of products) {
    let score = 0;
    const matchDetails: string[] = [];
    let bestVariant: ProductVariant | undefined;

    const normName = normalizeText(product.name);
    const normDesc = normalizeText(product.description || "");
    const nameTokens = tokenize(product.name);
    const descTokens = tokenize(product.description || "");

    // ── 1. Match exact nom (40 points) ──
    if (normName === normalizedQuery) {
      score += 40;
      matchDetails.push("nom exact");
    } else if (normName.includes(normalizedQuery)) {
      score += 30;
      matchDetails.push("nom contient");
    } else {
      // Sous-chaîne dans le nom
      let nameTokenMatches = 0;
      for (const qt of queryTokens) {
        if (normName.includes(qt)) {
          nameTokenMatches++;
        }
      }
      if (nameTokenMatches > 0) {
        score += (nameTokenMatches / queryTokens.length) * 25;
        matchDetails.push(`nom: ${nameTokenMatches}/${queryTokens.length} tokens`);
      }
    }

    // ── 2. Match description (20 points) ──
    if (normDesc) {
      let descMatches = 0;
      for (const qt of queryTokens) {
        if (normDesc.includes(qt)) {
          descMatches++;
        }
      }
      if (descMatches > 0) {
        score += (descMatches / queryTokens.length) * 15;
        matchDetails.push(`desc: ${descMatches}/${queryTokens.length} tokens`);
      }

      // Recherche de la requête complète dans la description
      if (normDesc.includes(normalizedQuery)) {
        score += 5;
        matchDetails.push("desc contient requête complète");
      }
    }

    // ── 3. Match des variantes (bonus sur le score nom) ──
    if (product.variants && Array.isArray(product.variants)) {
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

        if (variantScore > 0 && (!bestVariant || variantScore > 5)) {
          bestVariant = variant;
          score += variantScore;
          matchDetails.push(`variante: ${variant.name}`);
          break; // première variante qui match
        }
      }
    }

    // ── 4. Bonus dimensions (10 points) ──
    if (dimHints.length > 0 && normDesc) {
      let dimMatches = 0;
      for (const hint of dimHints) {
        // Cherche des nombres proches dans la description
        const dimPattern = new RegExp(
          `(?:${hint.valueCm - 5})\\s*cm|(?:${hint.valueCm})\\s*cm|(?:${hint.valueCm + 5})\\s*cm|` +
          `${Math.round(hint.valueCm / 100)}[.,]?\\d*\\s*m`,
          "i"
        );
        if (dimPattern.test(normDesc)) {
          dimMatches++;
        }
        // Cherche aussi dans le nom
        if (dimPattern.test(normName)) {
          dimMatches++;
        }
      }
      if (dimMatches > 0) {
        score += Math.min(10, dimMatches * 5);
        matchDetails.push(`dimensions: ${dimMatches} correspondances`);
      }
    }

    // ── 5. Bonus prix (10 points) ──
    if (priceHints.length > 0) {
      const productPrice =
        bestVariant?.price ||
        (product.variants?.[0]?.price ?? 0);

      if (productPrice > 0) {
        for (const hint of priceHints) {
          switch (hint.operator) {
            case "lt":
              if (productPrice <= hint.value) {
                score += 10;
                matchDetails.push(`prix ≤ ${hint.value}`);
              } else if (productPrice <= hint.value * 1.2) {
                score += 5;
                matchDetails.push(`prix proche ≤ ${hint.value} (${productPrice})`);
              }
              break;
            case "gt":
              if (productPrice >= hint.value) {
                score += 10;
                matchDetails.push(`prix ≥ ${hint.value}`);
              }
              break;
            case "around":
              const diff = Math.abs(productPrice - hint.value) / hint.value;
              if (diff <= 0.1) {
                score += 10;
                matchDetails.push(`prix ≈ ${hint.value}`);
              } else if (diff <= 0.3) {
                score += 5;
                matchDetails.push(`prix ~${hint.value} (${productPrice})`);
              }
              break;
          }
        }
      }
    }

    // ── Filtre : score > 0 pour être inclus ──
    if (score > 0 || !query.trim()) {
      scored.push({ product, score, matchedVariant: bestVariant, matchDetails });
    }
  }

  // Trier par score décroissant
  scored.sort((a, b) => b.score - a.score);

  return scored;
}

/**
 * Version simplifiée pour remplacer le filtre actuel de ProductSuggestions.
 * Retourne juste les produits filtrés (sans scoring détaillé).
 */
export function quickSearch(query: string, products: Product[]): Product[] {
  const results = smartSearch(query, products);
  return results.map(r => r.product);
}
