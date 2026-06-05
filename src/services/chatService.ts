// chatService.ts — Appel direct à DeepSeek avec injection de données (sans outils)
import type { MessagePayload, ResponsePayload } from "@/types";
import { remoteLog } from "./loggerService";
import { getPrompt, AGENTS_META, DEFAULT_AGENT, type AgentMode } from "./agentConfigStore";
import { injectProductData } from "./dataInjector";

const DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions";
const DEEPSEEK_KEY = import.meta.env.VITE_DEEPSEEK_KEY || "";
const MODEL = import.meta.env.VITE_AI_MODEL || "deepseek-chat";

const timeoutForContext = (sid: string) =>
  sid.startsWith("project_") ? 30 * 60 * 1000 : 15 * 60 * 1000;

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

    // 2. Injecter les données produits depuis Supabase
    systemPrompt = await injectProductData(systemPrompt, agent);

    // 3. Construire les messages
    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    let userContent = payload.message.content || "";
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
