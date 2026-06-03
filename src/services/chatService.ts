// chatService.ts — Appel direct à DeepSeek (remplace le webhook n8n)
import type { MessagePayload, ResponsePayload, TemplateType, PromptGuidelines } from "@/types";
import { determineMessagePayloadType } from "./webhook";
import { appLogger } from "@/utils/logger";

const DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions";
const DEEPSEEK_KEY = import.meta.env.VITE_DEEPSEEK_KEY || "";
const MODEL = import.meta.env.VITE_AI_MODEL || "deepseek-chat";

// Timeout adaptatif
const getTimeoutForContext = (sessionId: string): number => {
  if (sessionId.startsWith("project_")) return 30 * 60 * 1000;
  return 15 * 60 * 1000;
};

// Système prompt pour l'IA
const SYSTEM_PROMPT = `Tu es AssoAI, un assistant spécialisé dans la création de documents d'affaires pour une entreprise de signalétique/enseignes.

Tu peux créer et modifier les documents suivants :
- facture : numéro (F-YYYY-NNN), client, détails (description, quantité, prix unitaire, sous-total), total, statut
- devis : numéro (D-YYYY-NNN), client, validité en jours, détails, total
- commande : numéro (CMD-...), client, articles, statut, date de livraison
- cahier_des_charges : titre, enseignes (multiples avec dimensions, technique, matériaux), équipe

Réponds TOUJOURS en JSON avec cette structure exacte :
{
  "mode": "text" ou "template",
  "textFallback": "ta réponse textuelle (si mode=text)",
  "templateType": "facture" | "devis" | "commande" | "cahier_des_charges",
  "data": { ... les données complètes du document selon la structure demandée ... }
}

Règles pour les templates :
- facture : factureNumero (string), dateEmission (YYYY-MM-DD), client { nom, adresse, telephone? }, details [{ id, description, quantite (number), prixUnitaire (number), sous_total (number) }], total (number), version: 1, is_latest: true
- devis : devisNumero (string), dateEmission, validiteJours (number), client, details, total, version: 1, is_latest: true
- commande : commandeNumero (string), dateCommande, client, items [{ id, nom, quantite (number), prixUnitaire (number), sous_total (number) }], total, statut, version: 1, is_latest: true
- cahier_des_charges : titre, enseignes [{ id, nom, produits [{ id, nom }], details { dimensions { largeur, hauteur }, technique { type_structure, method_fabrication } } }], equipe [{ id, name, role }], version: 1, is_latest: true
`;

export async function sendChatRequest(payload: MessagePayload): Promise<ResponsePayload> {
  const startTime = Date.now();
  const timeoutMs = getTimeoutForContext(payload.sessionId);

  appLogger.info("🤖 Chat direct — début", {
    sessionId: payload.sessionId,
    messageType: payload.message.type,
    hasTemplate: !!payload.message.template,
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Construire les messages
    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    // Ajouter le contexte template si présent
    let userContent = payload.message.content || "";
    if (payload.message.template) {
      userContent += "\n\n--- TEMPLATE EXISTANT À MODIFIER ---\n" +
        JSON.stringify(payload.message.template, null, 2);
    }
    if (payload.message.quote) {
      userContent += "\n\n--- DOCUMENT CITÉ ---\n" +
        JSON.stringify(payload.message.quote, null, 2);
    }
    if (payload.message.promptGuidelines) {
      userContent += "\n\nGUIDELINES: " + payload.message.promptGuidelines.description;
    }

    messages.push({ role: "user", content: userContent });

    const response = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DEEPSEEK_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.3,
        max_tokens: 4096,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const elapsedTime = (Date.now() - startTime) / 1000;

    if (!response.ok) {
      const errorText = await response.text();
      appLogger.error("❌ OpenRouter error", { status: response.status, error: errorText });
      throw new Error(`OpenRouter: ${response.status} — ${errorText.slice(0, 200)}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    appLogger.info("✅ Chat direct — succès", {
      elapsedTime: `${elapsedTime}s`,
      contentLength: content.length,
    });

    // Parser la réponse JSON de l'IA
    let parsed: any;
    try {
      // Nettoyer les blocs markdown
      const cleaned = content
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { mode: "text", textFallback: content || "Désolé, je n'ai pas compris." };
    }

    // Si pas de data dans le template, ne pas le considérer comme template
    if (parsed.mode === "template" && !parsed.data) {
      parsed.mode = "text";
    }

    return {
      agentId: "assoai-agent",
      sessionId: payload.sessionId,
      timestamp: new Date().toISOString(),
      response: {
        mode: parsed.mode || "text",
        textFallback: parsed.textFallback || content,
        templateType: parsed.templateType,
        data: parsed.data,
        metadata: parsed.metadata || {
          displayName: parsed.templateType
            ? parsed.templateType.charAt(0).toUpperCase() + parsed.templateType.slice(1)
            : "Document",
          description: "Généré par AssoAI",
          availableActions: ["save", "download", "edit", "pdf"],
          mode: "editable",
          source: "chatMessage",
        },
      },
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    const elapsedTime = (Date.now() - startTime) / 1000;

    appLogger.error("❌ Chat direct — erreur", {
      error: error.message,
      elapsedTime: `${elapsedTime}s`,
    });

    throw error;
  }
}
