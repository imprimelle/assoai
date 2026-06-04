// tools.ts — Outils pour les agents (function calling DeepSeek)
// Tous les outils lisent depuis Supabase — zéro hardcodé

import { supabase } from "@/integrations/supabase/client";
import { remoteLog } from "./loggerService";

// ============================================================
// DÉFINITION DES OUTILS (format OpenAI/DeepSeek function calling)
// ============================================================

export const TOOL_DEFINITIONS = {
  search_products: {
    type: "function" as const,
    function: {
      name: "search_products",
      description: "Recherche un produit dans le catalogue Imprimelle par nom ou mot-clé. Retourne le nom, la description courte, les variantes avec leurs prix, les règles de fabrication détaillées (matériaux, opérations, formules), et un exemple de cahier des charges si disponible.",
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
      description: "Récupère les règles de fabrication complètes d'un type d'enseigne depuis le catalogue (colonne manufacturing_rules). Retourne la description détaillée, les règles techniques, les matériaux, les opérations, et un exemple de CDC si disponible.",
      parameters: {
        type: "object",
        properties: {
          type_enseigne: { type: "string", description: "Type d'enseigne (ex: 'caisson lumineux', 'néon flexible', 'totem', 'dibond', etc.)" }
        },
        required: ["type_enseigne"]
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
  const startTime = Date.now();
  remoteLog.info("tool", `▶ ${toolName}`, { args });

  try {
    let result: ToolResult;

    switch (toolName) {
      case "search_products": {
        const { query } = args;
        const { data, error } = await supabase
          .from("products")
          .select("name, description, main_image_url, variants, exemple, manufacturing_rules")
          .ilike("name", `%${query}%`)
          .order("name")
          .limit(5);
        if (error) throw error;
        result = {
          success: true,
          data: (data || []).map(p => {
            const mr = p.manufacturing_rules as any;
            const exempleFromRules = mr?.exemples?.substring(0, 500) || null;
            return {
              nom: p.name,
              description: p.description?.substring(0, 500) || "",
              image_url: p.main_image_url,
              exemple_cdc: p.exemple?.substring(0, 500) || exempleFromRules,
              variantes: (p.variants as any[] || []).map((v: any) => ({
                nom: v.name,
                prix: v.price,
                sku: v.sku
              })),
              règles_fabrication: mr?.description_complete?.substring(0, 2000) || null
            };
          })
        };
        break;
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
        result = {
          success: true,
          data: (data || []).map(m => {
            const d = (m.template_data as any)?.data || {};
            return { factureNumero: d.factureNumero, dateEmission: d.dateEmission, client: d.client, total: d.total, statut: d.statut, details: d.details };
          })
        };
        break;
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
        result = {
          success: true,
          data: (data || []).map(m => {
            const d = (m.template_data as any)?.data || {};
            return { commandeNumero: d.commandeNumero, dateCommande: d.dateCommande, dateLivraison: d.dateLivraison, client: d.client, total: d.total, statut: d.statut, items: d.items };
          })
        };
        break;
      }

      case "get_fabrication_rules": {
        const { type_enseigne } = args;
        const { data, error } = await supabase
          .from("products")
          .select("name, description, manufacturing_rules, exemple")
          .ilike("name", `%${type_enseigne}%`)
          .not("description", "is", null)
          .order("name")
          .limit(1);
        if (error) throw error;
        if (!data || data.length === 0) {
          // Fallback : lister les types disponibles
          remoteLog.warn("tool", `⚠ get_fabrication_rules — type "${type_enseigne}" non trouvé, fallback`);
          const { data: all } = await supabase.from("products").select("name").not("description", "is", null).limit(20);
          const types = (all || []).map(p => p.name);
          result = { success: false, data: null, error: `Type "${type_enseigne}" non trouvé. Types avec règles disponibles : ${types.join(", ")}` };
          break;
        }
        const p = data[0];
        const dcLen = (p.manufacturing_rules as any)?.description_complete?.length || 0;
        const exLen = (p.manufacturing_rules as any)?.exemples?.length || 0;
        remoteLog.debug("tool", `  get_fabrication_rules → "${p.name}"`, { rules_chars: dcLen, exemple_chars: exLen });
        result = {
          success: true,
          data: {
            type: p.name,
            description: p.description,
            manufacturing_rules: p.manufacturing_rules || [],
            exemple_cdc: p.exemple || null
          }
        };
        break;
      }

      case "list_product_types": {
        const { data } = await supabase
          .from("products")
          .select("name, description, manufacturing_rules")
          .not("description", "is", null)
          .order("name")
          .limit(20);
        const items = (data || []).map(p => ({
          type: p.name,
          has_rules: !!(p.manufacturing_rules as any)?.description_complete,
          has_example: !!(p.manufacturing_rules as any)?.exemples
        }));
        remoteLog.debug("tool", `  list_product_types → ${items.length} types`, {
          with_rules: items.filter(i => i.has_rules).length,
          with_example: items.filter(i => i.has_example).length
        });
        result = { success: true, data: items };
        break;
      }

      default: {
        remoteLog.error("tool", `✗ Outil inconnu : ${toolName}`);
        result = { success: false, data: null, error: `Outil inconnu : ${toolName}` };
      }
    }

    const elapsed = Date.now() - startTime;
    const dataSize = JSON.stringify(result.data || "").length;
    remoteLog.info("tool", `✔ ${toolName} (${elapsed}ms, ${dataSize}o)`, {
      success: result.success,
      elapsed_ms: elapsed,
      data_size: dataSize,
      error: result.error || undefined
    });
    return result;

  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    remoteLog.error("tool", `✗ ${toolName} — exception après ${elapsed}ms`, {
      error: error.message || "Erreur inconnue",
      args
    });
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
      return allTools.filter(t => ["get_fabrication_rules", "search_commandes", "list_product_types", "search_products"].includes(t.function.name));
    case "auto":
    default:
      return allTools;
  }
}
