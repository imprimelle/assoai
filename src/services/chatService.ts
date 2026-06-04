// chatService.ts — Appel direct à DeepSeek avec multi-agent (Wari/Brico/Auto)
import type { MessagePayload, ResponsePayload } from "@/types";
import { appLogger } from "@/utils/logger";
import { remoteLog } from "./loggerService";
import { AGENTS, DEFAULT_AGENT, type AgentMode } from "./agentPrompts";

const DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions";
const DEEPSEEK_KEY = import.meta.env.VITE_DEEPSEEK_KEY || "";
const MODEL = import.meta.env.VITE_AI_MODEL || "deepseek-chat";

// Timeout adaptatif
const timeoutForContext = (sid: string) => sid.startsWith("project_") ? 30 * 60 * 1000 : 15 * 60 * 1000;

export async function sendChatRequest(
  payload: MessagePayload,
  agent: AgentMode = DEFAULT_AGENT,
): Promise<ResponsePayload> {
  const startTime = Date.now();
  const timeoutMs = timeoutForContext(payload.sessionId);
  const agentCfg = AGENTS[agent] || AGENTS[DEFAULT_AGENT];

  remoteLog.info("chat", `Début requête IA — agent: ${agentCfg.label}`, {
    msgType: payload.message.type,
    contentLen: payload.message.content?.length || 0,
    hasTemplate: !!payload.message.template,
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: agentCfg.systemPrompt },
    ];

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
      body: JSON.stringify({ model: MODEL, messages, temperature: 0.3, max_tokens: 4096 }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const elapsedTime = (Date.now() - startTime) / 1000;

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepSeek: ${response.status} — ${errorText.slice(0, 200)}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    remoteLog.info("chat", `Réponse IA — agent: ${agentCfg.label}`, {
      elapsedMs: Math.round(elapsedTime * 1000),
      contentLen: content.length,
    });

    let parsed: any;
    try {
      const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { mode: "text", textFallback: content || "Désolé, je n'ai pas compris." };
    }

    if (parsed.mode === "template" && !parsed.data) {
      parsed.mode = "text";
    }

    return {
      agentId: `assoai-${agent}`,
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
          description: `Généré par ${agentCfg.label}`,
          availableActions: ["save", "download", "edit", "pdf"],
          mode: "editable",
          source: "chatMessage",
        },
      },
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    remoteLog.error("chat", `Erreur IA — agent: ${agentCfg.label}`, { error: error.message });
    throw error;
  }
}
