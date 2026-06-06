// chatService.ts — Appel direct à DeepSeek avec injection de données (sans outils)
import type { MessagePayload, ResponsePayload } from "@/types";
import { remoteLog } from "./loggerService";
import { appLogger } from "@/utils/logger";
import { getPrompt, AGENTS_META, DEFAULT_AGENT, type AgentMode } from "./agentConfigStore";
import { injectProductData } from "./dataInjector";
import { supabase } from "@/integrations/supabase/client";

const DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions";
const DEEPSEEK_KEY = import.meta.env.VITE_DEEPSEEK_KEY || "";
const MODEL = import.meta.env.VITE_AI_MODEL || "deepseek-chat";

const timeoutForContext = (sid: string) =>
  sid.startsWith("project_") ? 30 * 60 * 1000 : 15 * 60 * 1000;

// ============================================================
// RÉSOLUTION DU CONTEXTE DOCUMENT (création vs modification)
// ============================================================

type DocContext = {
  action: "create" | "modify" | "unknown";
  docType?: string;
  numero: string | null;
};

function extractExistingNumero(
  templateType: string,
  data: Record<string, any>
): string | null {
  switch (templateType) {
    case "facture":
      return data.factureNumero || null;
    case "devis":
      return data.devisNumero || null;
    case "commande":
      return data.commandeNumero || null;
    case "cahier_des_charges":
      return data.titre || null;
    default:
      return null;
  }
}

function detectDocTypeFromContent(content: string): string | null {
  const c = content.toLowerCase();
  // Priorité : CDC > commande > devis > facture
  if (c.includes("cahier des charges") || c.includes("cdc")) return "cahier_des_charges";
  if (c.includes("commande")) return "commande";
  if (c.includes("devis")) return "devis";
  if (c.includes("facture")) return "facture";
  return null;
}

/**
 * Alloue un numéro atomique via le RPC Supabase.
 * Retourne le numéro ou null si échec (fallback IA).
 */
async function allocateDocumentNumber(docType: string): Promise<string | null> {
  if (docType === "cahier_des_charges") return null; // CDC = titre libre
  try {
    const { data, error } = await supabase.rpc("next_document_number", {
      p_doc_type: docType,
    });
    if (error) {
      appLogger.warning("RPC next_document_number echoue, fallback IA", {
        docType,
        error: (error as any)?.message || String(error),
      });
      return null;
    }
    appLogger.info("Numero alloue", { docType, numero: data });
    return data as string;
  } catch (rpcErr: any) {
    appLogger.warning("RPC next_document_number exception, fallback IA", {
      docType,
      error: rpcErr?.message || String(rpcErr),
    });
    return null;
  }
}

async function resolveDocumentContext(
  payload: MessagePayload
): Promise<DocContext> {
  const userMsgType = detectDocTypeFromContent(payload.message.content || "");

  // 1. MODIFIER ou DERIVER : template present
  //    Si le message mentionne un type DIFFERENT → creation du nouveau type
  //    Sinon → modification du document reference
  if (payload.message.template) {
    const { templateType, data } = payload.message.template;
    if (userMsgType && userMsgType !== templateType) {
      // L'utilisateur veut un document d'un AUTRE type a partir de celui-ci
      const docNumber = await allocateDocumentNumber(userMsgType);
      appLogger.info("Contexte document : DERIVATION", {
        from: templateType,
        to: userMsgType,
        numero: docNumber || "(fallback IA)",
      });
      return {
        action: "create",
        docType: userMsgType,
        numero: docNumber,
      };
    }
    // Meme type → modification
    const numero = extractExistingNumero(templateType, data as Record<string, any>);
    appLogger.info("Contexte document : MODIFICATION", {
      templateType,
      numero,
      source: "template",
    });
    return { action: "modify", docType: templateType, numero };
  }

  // 2. MODIFIER ou DERIVER : citation d'un document (quote)
  if (payload.message.quote?.templateType && payload.message.quote?.numero) {
    const quoteType = payload.message.quote.templateType;
    if (userMsgType && userMsgType !== quoteType) {
      const docNumber = await allocateDocumentNumber(userMsgType);
      appLogger.info("Contexte document : DERIVATION (via quote)", {
        from: quoteType,
        to: userMsgType,
        numero: docNumber || "(fallback IA)",
      });
      return {
        action: "create",
        docType: userMsgType,
        numero: docNumber,
      };
    }
    appLogger.info("Contexte document : CITATION", {
      templateType: quoteType,
      numero: payload.message.quote.numero,
      source: "quote",
    });
    return {
      action: "modify",
      docType: quoteType,
      numero: payload.message.quote.numero,
    };
  }

  // 3. CREER : detection du type par mot-cle dans le message
  if (userMsgType) {
    const docNumber = await allocateDocumentNumber(userMsgType);
    return {
      action: docNumber ? "create" : "unknown",
      docType: userMsgType,
      numero: docNumber,
    };
  }

  // 4. AMBIGU : on laisse l'IA decider
  return { action: "unknown", numero: null };
}

export async function sendChatRequest(
  payload: MessagePayload,
  agent: AgentMode = DEFAULT_AGENT,
): Promise<ResponsePayload> {
  const startTime = Date.now();
  const timeoutMs = timeoutForContext(payload.sessionId);
  const agentCfg = AGENTS_META[agent] || AGENTS_META[DEFAULT_AGENT];

  remoteLog.info("chat", `Requête IA — agent: ${agentCfg.label}`, {
    contentLen: payload.message.content?.length || 0,
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // 1. Charger le prompt système (éditable par l'utilisateur)
    let systemPrompt = getPrompt(agent);

    // Log: prompt système chargé
    appLogger.info(`[${agentCfg.label}] Prompt système chargé`, {
      agent,
      source: "prompt",
      prompt_len: systemPrompt.length,
      prompt_preview: systemPrompt.substring(0, 500),
    });

    // 2. Injecter les données produits depuis Supabase
    const promptBeforeInjection = systemPrompt;
    systemPrompt = await injectProductData(systemPrompt, agent);

    // Log: injection DB
    const injectedLen = systemPrompt.length - promptBeforeInjection.length;
    if (injectedLen > 0) {
      appLogger.info(`[${agentCfg.label}] Données DB injectées`, {
        agent,
        source: "db-injection",
        injected_chars: injectedLen,
        prompt_after_len: systemPrompt.length,
      });
    }

    // 2.5. Résoudre le contexte document (création vs modification)
    const docCtx = await resolveDocumentContext(payload);
    const docNumber = docCtx.numero || "";
    systemPrompt = systemPrompt.replace(/{DOCUMENT_NUMBER}/g, docNumber);

    appLogger.info(`[${agentCfg.label}] Contexte document résolu`, {
      agent,
      source: "doc-context",
      action: docCtx.action,
      docType: docCtx.docType || "none",
      numero: docNumber || "(vide)",
    });

    // 3. Construire les messages
    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    let userContent = payload.message.content || "";
    // Injecter le numéro de document directement dans le message (bypass prompt personnalisé)
    if (docNumber) {
      userContent = `⚠️ NUMÉRO RÉSERVÉ : ${docNumber}. Utilise EXACTEMENT ce numéro dans le document.\n\n${userContent}`;
    }
    if (payload.message.template) {
      userContent +=
        "\n\n--- TEMPLATE EXISTANT ---\n" +
        JSON.stringify(payload.message.template, null, 2);
    }
    if (payload.message.quote) {
      userContent +=
        "\n\n--- DOCUMENT CITÉ ---\n" +
        JSON.stringify(payload.message.quote, null, 2);
    }
    messages.push({ role: "user", content: userContent });

    // 4. Appel direct DeepSeek (pas de tools, pas de boucle)
    remoteLog.debug("chat", `→ DeepSeek (${agentCfg.label})`, {
      model: MODEL,
      prompt_len: systemPrompt.length,
    });

    const body: any = {
      model: MODEL,
      messages,
      temperature: 0.3,
      max_tokens: 4096,
    };
    body.response_format = { type: "json_object" };
    body.stop = ["```", "\n\n\n"];

    const response = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_KEY}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const err = await response.text();
      remoteLog.error("chat", `DeepSeek HTTP ${response.status}`, {
        status: response.status,
        body: err.slice(0, 300),
      });
      throw new Error(`DeepSeek ${response.status}: ${err.slice(0, 200)}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const elapsed = (Date.now() - startTime) / 1000;

    if (data.usage) {
      remoteLog.debug("chat", `✅ DeepSeek OK (${Math.round(elapsed)}s)`, {
        prompt_tokens: data.usage.prompt_tokens,
        completion_tokens: data.usage.completion_tokens,
        finish_reason: data.choices?.[0]?.finish_reason,
      });
    }

    remoteLog.info("chat", `✅ Réponse — agent: ${agentCfg.label}`, {
      total_sec: Math.round(elapsed),
      content_len: content.length,
    });

    // Log: réponse agent (dans l'UI)
    appLogger.info(`[${agentCfg.label}] Réponse reçue`, {
      agent,
      source: "response",
      elapsed_sec: Math.round(elapsed),
      content_len: content.length,
      content_preview: content.substring(0, 500),
      tokens: data.usage
        ? { prompt: data.usage.prompt_tokens, completion: data.usage.completion_tokens }
        : undefined,
    });

    await remoteLog.flush();
    return parseAIResponse(content, payload.sessionId, agent);
  } catch (error: any) {
    clearTimeout(timeoutId);
    remoteLog.error("chat", `Erreur IA — ${agentCfg.label}`, {
      error: error.message,
    });
    await remoteLog.flush();
    throw error;
  }
}

// ============================================================
// PARSING
// ============================================================

function parseAIResponse(
  content: string,
  sessionId: string,
  agent: string,
): ResponsePayload {
  let parsed: any;
  let parseOk = false;
  try {
    const cleaned = content
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();
    parsed = JSON.parse(cleaned);
    parseOk = true;
  } catch {
    parsed = {
      mode: "text",
      textFallback: content || "Désolé, je n'ai pas compris.",
    };
    remoteLog.warn("chat", `⚠ parseAIResponse — JSON invalide, fallback texte`, {
      agent,
      content_preview: content.slice(0, 200),
    });
  }
  if (parsed.mode === "template" && !parsed.data) {
    remoteLog.warn("chat", `⚠ parseAIResponse — mode=template sans data, forcé texte`, { agent });
    parsed.mode = "text";
  }

  remoteLog.debug("chat", `  parseAIResponse — mode: ${parsed.mode}`, {
    parse_ok: parseOk,
    template_type: parsed.templateType || "none",
    has_data: !!parsed.data,
    agent,
  });

  return {
    agentId: `assoai-${agent}`,
    sessionId,
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
        description: `Généré par ${AGENTS_META[agent as AgentMode]?.label || agent}`,
        availableActions: ["save", "download", "edit", "pdf"],
        mode: "editable",
        source: "chatMessage",
      },
    },
  };
}
