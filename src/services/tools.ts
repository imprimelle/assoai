// tools.ts — Outils pour les agents (function calling DeepSeek)
// Tous les outils lisent depuis Supabase — zéro hardcodé

import { supabase } from "@/integrations/supabase/client";

// ============================================================
// DÉFINITION DES OUTILS (format OpenAI/DeepSeek function calling)
// ============================================================

export const TOOL_DEFINITIONS = {
  search_products: {
    type: "function" as const,
    function: {
      name: "search_products",
      description: "Recherche un produit dans le catalogue Imprimelle par nom ou mot-clé. Retourne le nom, la description (qui contient les règles de fabrication pour ce type d'enseigne), les variantes avec leurs prix, et un exemple de cahier des charges si disponible.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Nom du produit ou mot-clé (ex: 'Panneau LED', 'caisson', 'totem')" }
        },
        required: ["query"]
      }
    }
  },
  search_factures: {
    type: "function" as const,
    function: {
      name: "search_factures",
      description: "Recherche une facture par numéro (F-YYYY-NNN) ou par nom de client. Retourne les détails de la facture.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Numéro de facture (ex: F-2026-001) ou nom du client" }
        },
        required: ["query"]
      }
    }
  },
  search_commandes: {
    type: "function" as const,
    function: {
      name: "search_commandes",
      description: "Recherche une commande par numéro (CMD-...) ou par nom de client. Retourne les articles et statut.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Numéro de commande (ex: CMD-2026-001) ou nom du client" }
        },
        required: ["query"]
      }
    }
  },
  get_fabrication_rules: {
    type: "function" as const,
    function: {
      name: "get_fabrication_rules",
      description: "Récupère les règles de fabrication d'un type d'enseigne en lisant la description complète du produit dans le catalogue. La description contient les matériaux, opérations et règles techniques. Retourne aussi un exemple de CDC si disponible.",
      parameters: {
        type: "object",
        properties: {
          type_enseigne: { type: "string", description: "Type d'enseigne (ex: 'caisson lumineux', 'néon flexible', 'totem', 'dibond', etc.)" }
        },
        required: ["type_enseigne"]
      }
    }
  },
  calculate_materials: {
    type: "function" as const,
    function: {
      name: "calculate_materials",
      description: "Calcule les quantités de matériaux nécessaires en fonction des dimensions de l'enseigne. Lit les règles depuis le produit catalogue correspondant.",
      parameters: {
        type: "object",
        properties: {
          type_enseigne: { type: "string", description: "Type d'enseigne" },
          largeur_cm: { type: "number", description: "Largeur en centimètres" },
          hauteur_cm: { type: "number", description: "Hauteur en centimètres" },
        },
        required: ["type_enseigne", "largeur_cm", "hauteur_cm"]
      }
    }
  },
  list_product_types: {
    type: "function" as const,
    function: {
      name: "list_product_types",
      description: "Liste tous les produits qui contiennent des règles de fabrication (description non vide), c'est-à-dire tous les types d'enseignes disponibles.",
      parameters: { type: "object", properties: {} }
    }
  }
};

// ============================================================
// IMPLÉMENTATION DES OUTILS (tous depuis Supabase)
// ============================================================

export interface ToolResult { success: boolean; data: any; error?: string; }

export async function executeToolCall(toolName: string, args: Record<string, any>): Promise<ToolResult> {
  try {
    switch (toolName) {
      case "search_products": {
        const { query } = args;
        const { data, error } = await supabase
          .from("products")
          .select("name, description, main_image_url, variants, exemple, manufacturing_rules")
          .ilike("name", `%${query}%`)
          .limit(5);
        if (error) throw error;
        return {
          success: true,
          data: (data || []).map(p => ({
            nom: p.name,
            description: p.description?.substring(0, 500) || "",  // règles de fabrication
            image_url: p.main_image_url,
            exemple_cdc: p.exemple?.substring(0, 500) || null,      // exemple CDC
            variantes: (p.variants as any[] || []).map((v: any) => ({
              nom: v.name,
              prix: v.price,
              sku: v.sku
            })),
            règles_fabrication: p.manufacturing_rules || []
          }))
        };
      }

      case "search_factures": {
        const { query } = args;
        const { data, error } = await supabase
          .from("messages")
          .select("template_data")
          .eq("template_type", "facture")
          .or(
            `template_data->data->>factureNumero.ilike.%${query}%,` +
            `template_data->data->>client->>nom.ilike.%${query}%`
          )
          .filter("template_data->data->>is_latest", "eq", "true")
          .limit(3);
        if (error) throw error;
        return {
          success: true,
          data: (data || []).map(m => {
            const d = (m.template_data as any)?.data || {};
            return { factureNumero: d.factureNumero, dateEmission: d.dateEmission, client: d.client, total: d.total, statut: d.statut, details: d.details };
          })
        };
      }

      case "search_commandes": {
        const { query } = args;
        const { data, error } = await supabase
          .from("messages")
          .select("template_data")
          .eq("template_type", "commande")
          .or(
            `template_data->data->>commandeNumero.ilike.%${query}%,` +
            `template_data->data->>client->>nom.ilike.%${query}%`
          )
          .filter("template_data->data->>is_latest", "eq", "true")
          .limit(3);
        if (error) throw error;
        return {
          success: true,
          data: (data || []).map(m => {
            const d = (m.template_data as any)?.data || {};
            return { commandeNumero: d.commandeNumero, dateCommande: d.dateCommande, dateLivraison: d.dateLivraison, client: d.client, total: d.total, statut: d.statut, items: d.items };
          })
        };
      }

      case "get_fabrication_rules": {
        const { type_enseigne } = args;
        const { data, error } = await supabase
          .from("products")
          .select("name, description, manufacturing_rules, exemple")
          .ilike("name", `%${type_enseigne}%`)
          .not("description", "is", null)
          .limit(1);
        if (error) throw error;
        if (!data || data.length === 0) {
          // Fallback : lister les types disponibles
          const { data: all } = await supabase.from("products").select("name").not("description", "is", null).limit(20);
          const types = (all || []).map(p => p.name);
          return { success: false, data: null, error: `Type "${type_enseigne}" non trouvé. Types avec règles disponibles : ${types.join(", ")}` };
        }
        const p = data[0];
        return {
          success: true,
          data: {
            type: p.name,
            description: p.description,
            manufacturing_rules: p.manufacturing_rules || [],
            exemple_cdc: p.exemple || null
          }
        };
      }

      case "calculate_materials": {
        const { type_enseigne, largeur_cm, hauteur_cm } = args;
        // Lire les règles du produit correspondant
        const { data } = await supabase
          .from("products")
          .select("name, description, manufacturing_rules")
          .ilike("name", `%${type_enseigne}%`)
          .not("description", "is", null)
          .limit(1);
        if (!data || data.length === 0) {
          return { success: false, data: null, error: `Type "${type_enseigne}" non trouvé` };
        }
        const prod = data[0];
        const rules = prod.manufacturing_rules as any[] || [];
        
        const surface_m2 = (largeur_cm * hauteur_cm) / 10000;
        const perimetre_m = (2 * (largeur_cm + hauteur_cm)) / 100;
        
        return {
          success: true,
          data: {
            type: prod.name,
            dimensions: { largeur_cm, hauteur_cm },
            surface_m2: Math.round(surface_m2 * 100) / 100,
            perimetre_m: Math.round(perimetre_m * 100) / 100,
            regles_applicables: rules,
            note: "Les quantités exactes dépendent des matériaux spécifiques listés dans les règles de fabrication de ce produit."
          }
        };
      }

      case "list_product_types": {
        const { data } = await supabase
          .from("products")
          .select("name, description, exemple")
          .not("description", "is", null)
          .limit(20);
        return {
          success: true,
          data: (data || []).map(p => ({
            type: p.name,
            has_rules: !!p.description,
            has_example: !!p.exemple
          }))
        };
      }

      default:
        return { success: false, data: null, error: `Outil inconnu : ${toolName}` };
    }
  } catch (error: any) {
    return { success: false, data: null, error: error.message || "Erreur inconnue" };
  }
}

// Filtrer les outils disponibles par agent
export function getToolsForAgent(agent: string): any[] {
  const allTools = Object.values(TOOL_DEFINITIONS);
  switch (agent) {
    case "wari":
      return allTools.filter(t => ["search_products", "search_factures", "search_commandes"].includes(t.function.name));
    case "brico":
      return allTools.filter(t => ["get_fabrication_rules", "calculate_materials", "search_commandes", "list_product_types", "search_products"].includes(t.function.name));
    case "auto":
    default:
      return allTools;
  }
}
