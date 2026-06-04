// tools.ts — Outils pour les agents (function calling DeepSeek)
// Chaque outil est une fonction asynchrone appelable par l'IA

import { supabase } from "@/integrations/supabase/client";
import { FABRICATION_RULES, getFabricationRule, getAvailableTypes } from "./fabricationRules";

// ============================================================
// DÉFINITION DES OUTILS (format OpenAI/DeepSeek function calling)
// ============================================================

export const TOOL_DEFINITIONS = {
  search_products: {
    type: "function" as const,
    function: {
      name: "search_products",
      description: "Recherche un produit dans le catalogue Imprimelle par nom ou mot-clé. Retourne le nom, la description, les variantes et leurs prix.",
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
      description: "Récupère les règles de fabrication, matériaux et opérations pour un type d'enseigne spécifique (caisson lumineux, néon flexible, lettres découpées, dibond, totem, panneau publicitaire).",
      parameters: {
        type: "object",
        properties: {
          type_enseigne: { type: "string", description: "Type d'enseigne : 'caisson lumineux', 'néon flexible', 'lettres découpées', 'dibond', 'totem', 'panneau publicitaire'" }
        },
        required: ["type_enseigne"]
      }
    }
  },
  calculate_materials: {
    type: "function" as const,
    function: {
      name: "calculate_materials",
      description: "Calcule les quantités de matériaux nécessaires en fonction des dimensions de l'enseigne. Retourne la liste des matériaux avec quantités calculées.",
      parameters: {
        type: "object",
        properties: {
          type_enseigne: { type: "string", description: "Type d'enseigne" },
          largeur_cm: { type: "number", description: "Largeur en centimètres" },
          hauteur_cm: { type: "number", description: "Hauteur en centimètres" },
          profondeur_cm: { type: "number", description: "Profondeur en centimètres (optionnel)" }
        },
        required: ["type_enseigne", "largeur_cm", "hauteur_cm"]
      }
    }
  },
  list_enseigne_types: {
    type: "function" as const,
    function: {
      name: "list_enseigne_types",
      description: "Liste tous les types d'enseignes disponibles dans le catalogue de fabrication.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  }
};

// Type de retour pour les outils
export interface ToolResult {
  success: boolean;
  data: any;
  error?: string;
}

// ============================================================
// IMPLÉMENTATION DES OUTILS
// ============================================================

export async function executeToolCall(
  toolName: string,
  args: Record<string, any>
): Promise<ToolResult> {
  try {
    switch (toolName) {
      case "search_products": {
        const { query } = args;
        const { data, error } = await supabase
          .from("products")
          .select("name, description, main_image_url, variants")
          .ilike("name", `%${query}%`)
          .limit(5);
        if (error) throw error;
        return {
          success: true,
          data: (data || []).map(p => ({
            nom: p.name,
            description: p.description,
            image_url: p.main_image_url,
            variantes: (p.variants as any[] || []).map((v: any) => ({
              nom: v.name,
              prix: v.price,
              sku: v.sku
            }))
          }))
        };
      }

      case "search_factures": {
        const { query } = args;
        // Chercher par numéro exact ou par nom client
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
            return {
              factureNumero: d.factureNumero,
              dateEmission: d.dateEmission,
              client: d.client,
              total: d.total,
              statut: d.statut,
              details: d.details
            };
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
            return {
              commandeNumero: d.commandeNumero,
              dateCommande: d.dateCommande,
              dateLivraison: d.dateLivraison,
              client: d.client,
              total: d.total,
              statut: d.statut,
              items: d.items
            };
          })
        };
      }

      case "get_fabrication_rules": {
        const { type_enseigne } = args;
        const rule = getFabricationRule(type_enseigne);
        if (!rule) {
          return {
            success: false,
            data: null,
            error: `Type d'enseigne "${type_enseigne}" non trouvé. Types disponibles : ${getAvailableTypes().join(", ")}`
          };
        }
        return { success: true, data: rule };
      }

      case "calculate_materials": {
        const { type_enseigne, largeur_cm, hauteur_cm } = args;
        const rule = getFabricationRule(type_enseigne);
        if (!rule) {
          return {
            success: false,
            data: null,
            error: `Type "${type_enseigne}" non trouvé. Types : ${getAvailableTypes().join(", ")}`
          };
        }
        // Calcul simplifié des quantités
        const surface_m2 = (largeur_cm * hauteur_cm) / 10000;
        const perimetre_m = (2 * (largeur_cm + hauteur_cm)) / 100;

        const materials = rule.materiaux.map(m => {
          let quantite = 0;
          if (m.unite === "m²") quantite = Math.ceil(surface_m2 * 1.1); // +10% marge
          else if (m.unite === "m") quantite = Math.ceil(perimetre_m * 1.1);
          else if (m.unite === "pièce") quantite = 1;
          else if (m.unite === "tube") quantite = Math.ceil(surface_m2 * 2);
          else if (m.unite === "sac") quantite = 2;
          return { ...m, quantite_calculee: quantite };
        });

        return { success: true, data: { type_enseigne, dimensions: { largeur_cm, hauteur_cm }, surface_m2, perimetre_m, materials } };
      }

      case "list_enseigne_types": {
        return { success: true, data: getAvailableTypes() };
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
      return allTools.filter(t => 
        ["search_products", "search_factures", "search_commandes"].includes(t.function.name)
      );
    case "brico":
      return allTools.filter(t =>
        ["get_fabrication_rules", "calculate_materials", "search_commandes", "list_enseigne_types", "search_products"].includes(t.function.name)
      );
    case "auto":
    default:
      return allTools; // Tous les outils
  }
}
