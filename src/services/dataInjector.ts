// dataInjector.ts — Fetch produits Supabase et formattage pour injection dans les prompts
// Wari reçoit : nom + description + variantes (prix)
// Brico reçoit : nom + manufacturing_rules
// Auto ne reçoit rien (il route seulement)

import { supabase } from "@/integrations/supabase/client";
import type { AgentMode } from "./agentConfigStore";

const MAX_PRODUCTS = 20;

interface ProductRow {
  name: string;
  description: string | null;
  variants: any[] | null;
  manufacturing_rules: any | null;
}

// ============================================================
// FETCH
// ============================================================

async function fetchProducts(): Promise<ProductRow[]> {
  const { data, error } = await supabase
    .from("products")
    .select("name, description, variants, manufacturing_rules")
    .order("name")
    .limit(MAX_PRODUCTS);

  if (error) {
    console.warn("dataInjector: erreur Supabase", error);
    return [];
  }
  return (data || []) as ProductRow[];
}

// ============================================================
// FORMATTAGE PAR AGENT
// ============================================================

function formatForWari(products: ProductRow[]): string {
  if (products.length === 0) return "Aucun produit dans le catalogue.";

  return products
    .map((p) => {
      const desc = p.description || "—";
      const variants = (p.variants || []) as any[];
      const prixStr =
        variants.length > 0
          ? variants
              .map((v: any) => `  - ${v.name || "Standard"} : ${v.price || "—"} FCFA${v.sku ? ` (SKU: ${v.sku})` : ""}`)
              .join("\n")
          : "  - Prix non défini";

      return `### ${p.name}\nDescription : ${desc.substring(0, 300)}\nVariantes :\n${prixStr}`;
    })
    .join("\n\n");
}

function formatForBrico(products: ProductRow[]): string {
  if (products.length === 0) return "Aucune règle de fabrication disponible.";

  return products
    .filter((p) => {
      const mr = p.manufacturing_rules as any;
      return mr?.description_complete || p.description;
    })
    .map((p) => {
      const mr = (p.manufacturing_rules as any) || {};
      const rules = mr.description_complete || p.description || "—";
      const exemple = mr.exemples || "";

      let block = `### ${p.name}\n`;
      block += `Règles : ${rules.substring(0, 2000)}`;
      if (exemple) {
        block += `\nExemple CDC : ${exemple.substring(0, 500)}`;
      }
      return block;
    })
    .join("\n\n");
}

// ============================================================
// API PUBLIQUE
// ============================================================

/**
 * Injecte les données produits dans le prompt système de l'agent.
 * - Auto : pas d'injection (il route seulement)
 * - Wari : noms + descriptions + variantes/prix
 * - Brico : noms + manufacturing_rules
 */
export async function injectProductData(
  systemPrompt: string,
  agent: AgentMode,
): Promise<string> {
  const products = await fetchProducts();

  if (agent === "wari") {
    const injected = formatForWari(products);
    return systemPrompt.replace("{INJECTED_PRODUCTS}", injected);
  }

  if (agent === "brico") {
    const injected = formatForBrico(products);
    return systemPrompt.replace("{INJECTED_RULES}", injected);
  }

  return systemPrompt;
}
