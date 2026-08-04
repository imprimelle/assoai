// src/services/initialCdc.ts
// Création DÉTERMINISTE (sans LLM) d'un CDC squelettique à l'initialisation du projet.
// Flux : facture + commande → bouton « Initialiser le projet » → ce service crée un CDC
// sans matériaux (enseignes issues de la commande, images, dimensions), lié au projet,
// affiché dans CdcListe et éditable ensuite dans le CDC builder.
//
// Format du payload aligné sur buildCdcPayload() du CdcBuilder (src/pages/CdcBuilder.tsx)
// et sur CahierDesChargesData (src/types/template-data.ts).

import { supabase } from "@/integrations/supabase/client";
import type { CommandeData, CommandeItem, Enseigne } from "@/types";

// ── Dimensions ──

/**
 * Tente d'extraire largeur/hauteur (cm) depuis le nom d'un produit.
 * Formats gérés : "1m/70cm", "1,2m/90cm", "1.5m/80cm", "100x200", "100x200cm", "100 cm x 200 cm".
 * Retourne null si aucun pattern trouvé → l'appelant utilisera les dimensions par défaut.
 */
export function parseDimensionsFromName(
  nom: string,
): { largeur: number; hauteur: number } | null {
  if (!nom) return null;
  const s = nom.toLowerCase().trim();

  // Pattern 1 : "1m/70cm" | "1,2m/90cm" | "1.5m/80 cm" (largeur en m, hauteur en cm)
  const mPattern = s.match(
    /(\d+(?:[.,]\d+)?)\s*m\s*[/x×]\s*(\d+(?:[.,]\d+)?)\s*cm/,
  );
  if (mPattern) {
    const largeur = Math.round(parseFloat(mPattern[1].replace(",", ".")) * 100);
    const hauteur = Math.round(parseFloat(mPattern[2].replace(",", ".")));
    if (largeur > 0 && hauteur > 0) return { largeur, hauteur };
  }

  // Pattern 2 : "100x200cm" | "100 x 200 cm" | "100cm x 200cm" (les deux en cm)
  const cmPattern = s.match(
    /(\d+(?:[.,]\d+)?)\s*cm\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*cm/,
  );
  if (cmPattern) {
    const largeur = Math.round(parseFloat(cmPattern[1].replace(",", ".")));
    const hauteur = Math.round(parseFloat(cmPattern[2].replace(",", ".")));
    if (largeur > 0 && hauteur > 0) return { largeur, hauteur };
  }

  // Pattern 3 : "100x200" (deux nombres séparés par x, sans unité)
  const barePattern = s.match(/(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)/);
  if (barePattern) {
    const largeur = Math.round(parseFloat(barePattern[1].replace(",", ".")));
    const hauteur = Math.round(parseFloat(barePattern[2].replace(",", ".")));
    // Garde-fou : deux nombres du même ordre de grandeur (ex: prix "2 x 150000" exclu)
    if (largeur >= 10 && largeur <= 1000 && hauteur >= 10 && hauteur <= 1000) {
      return { largeur, hauteur };
    }
  }

  return null;
}

/** Dimensions par défaut utilisées par le CDC builder (useCdcBuilderLoader) */
export const DEFAULT_ENSEIGNE_DIMENSIONS = { largeur: 200, hauteur: 100 };

// ── Construction des enseignes ──

/**
 * Convertit un item de commande en enseigne CDC (squelette, sans matériaux).
 * Reprend la logique de createEmptyEnseigneFromItem() du loader, avec parsing des dimensions.
 */
function buildEnseigneFromCommandeItem(
  item: CommandeItem,
  index: number,
): Enseigne {
  const parsed = parseDimensionsFromName(item.nom);
  return {
    id: crypto.randomUUID?.() ||
      `ens-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    nom: item.nom || `Enseigne ${index + 1}`,
    produits: item.image_url
      ? [{ id: item.id, nom: item.nom, image_url: item.image_url }]
      : [],
    details: {
      image_url: item.image_url,
      dimensions: parsed || DEFAULT_ENSEIGNE_DIMENSIONS,
      technique: { type_structure: "", method_fabrication: "" },
    },
    materiauxSections: {},
  };
}

// ── Création du CDC ──

export interface CreateInitialCdcInput {
  project: { id: string; name: string };
  commande: CommandeData;
  userId: string;
  sessionId: string;
}

export interface CreateInitialCdcResult {
  id: string;
  cdcNumero: string;
}

/**
 * Crée le CDC déterministe à l'initialisation du projet :
 * 1. Alloue le numéro CDC via RPC next_document_number
 * 2. Construit les enseignes depuis les items de la commande (sans matériaux)
 * 3. INSERT dans messages (template_type=cahier_des_charges, project_id lié)
 * 4. Attache l'ID dans projects.templates.cahiers_des_charges
 */
export async function createInitialCdcFromCommande({
  project,
  commande,
  userId,
  sessionId,
}: CreateInitialCdcInput): Promise<CreateInitialCdcResult> {
  // 1. Numéro CDC
  let cdcNumero = "";
  try {
    const { data, error } = await supabase.rpc("next_document_number", {
      p_doc_type: "cahier_des_charges",
    });
    if (error) throw error;
    cdcNumero = String(data || "");
  } catch (e) {
    console.warn("[initialCdc] RPC next_document_number failed:", e);
  }
  if (!cdcNumero) {
    cdcNumero = `CDC-${new Date().getFullYear()}-TMP`;
  }

  // 2. Enseignes depuis les items de la commande (squelette, materiauxSections vides)
  const items = (commande.items || []).filter((it) => it.nom);
  const enseignes: Enseigne[] = items.map(buildEnseigneFromCommandeItem);
  // Garde-fou : le loader du CDC builder refuse un CDC sans enseignes →
  // créer une enseigne placeholder pour garantir l'éditabilité
  if (enseignes.length === 0) {
    enseignes.push({
      id: crypto.randomUUID?.() ||
        `ens-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      nom: "Nouvelle enseigne",
      produits: [],
      details: {
        image_url: undefined,
        dimensions: DEFAULT_ENSEIGNE_DIMENSIONS,
        technique: { type_structure: "", method_fabrication: "" },
      },
      materiauxSections: {},
    });
  }

  // 3. Payload au format CahierDesChargesData / buildCdcPayload
  const payload = {
    titre: `Cahier des Charges — ${project.name || "Sans titre"}`,
    cdcNumero,
    commande_id: commande.commandeNumero || null,
    statut: "Brouillon",
    enseignes,
    equipe: [],
    deliveryAddress: commande.deliveryAddress,
    version: 1,
    is_latest: true,
  };

  // 4. INSERT dans messages (mêmes colonnes que le CDC builder)
  const cdcId = crypto.randomUUID();
  const { error: insertErr } = await supabase.from("messages").insert({
    id: cdcId,
    user_id: userId,
    sender: "user",
    project_id: project.id,
    template_type: "cahier_des_charges",
    template_data: { data: payload, version: 1 },
    timestamp: new Date().toISOString(),
    session_id: sessionId,
  });
  if (insertErr) throw insertErr;

  // 5. Attacher l'ID dans projects.templates.cahiers_des_charges
  try {
    const { data: proj } = await supabase
      .from("projects")
      .select("templates")
      .eq("id", project.id)
      .single();
    const templates = (proj?.templates as any) || {};
    const cdCs = Array.isArray(templates.cahiers_des_charges)
      ? [...templates.cahiers_des_charges]
      : [];
    if (!cdCs.includes(cdcId)) cdCs.push(cdcId);
    await supabase
      .from("projects")
      .update({ templates: { ...templates, cahiers_des_charges: cdCs } })
      .eq("id", project.id);
  } catch (e) {
    // Non bloquant : le lien project_id dans messages suffit pour l'affichage
    console.warn("[initialCdc] templates update failed:", e);
  }

  return { id: cdcId, cdcNumero };
}
