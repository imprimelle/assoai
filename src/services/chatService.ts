// chatService.ts — Appel direct à DeepSeek avec multi-agent + function calling
import type { MessagePayload, ResponsePayload } from "@/types";
import { remoteLog } from "./loggerService";
import { AGENTS, DEFAULT_AGENT, type AgentMode } from "./agentPrompts";
import { getToolsForAgent, executeToolCall } from "./tools";

const DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions";
const DEEPSEEK_KEY = import.meta.env.VITE_DEEPSEEK_KEY || "";
const MODEL = import.meta.env.VITE_AI_MODEL || "deepseek-chat";

const timeoutForContext = (sid: string) => sid.startsWith("project_") ? 30 * 60 * 1000 : 15 * 60 * 1000;
const MAX_TOOL_ROUNDS = 3;

export async function sendChatRequest(
  payload: MessagePayload,
  agent: AgentMode = DEFAULT_AGENT,
): Promise<ResponsePayload> {
  const startTime = Date.now();
  const timeoutMs = timeoutForContext(payload.sessionId);
  const agentCfg = AGENTS[agent] || AGENTS[DEFAULT_AGENT];
  const tools = getToolsForAgent(agent);

  remoteLog.info("chat", `Requête IA — agent: ${agentCfg.label}`, {
    contentLen: payload.message.content?.length || 0,
    toolsCount: tools.length,
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Construire le fil de messages
    const messages: Array<{ role: string; content: string; tool_calls?: any[]; tool_call_id?: string }> = [
      { role: "system", content: agentCfg.systemPrompt },
    ];

    let userContent = payload.message.content || "";
    if (payload.message.template) {
      userContent += "\n\n--- TEMPLATE EXISTANT ---\n" + JSON.stringify(payload.message.template, null, 2);
    }
    if (payload.message.quote) {
      userContent += "\n\n--- DOCUMENT CITÉ ---\n" + JSON.stringify(payload.message.quote, null, 2);
    }
    messages.push({ role: "user", content: userContent });

    // === TOOL LOOP ===
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const body: any = { model: MODEL, messages, temperature: 0.3, max_tokens: 4096 };
      if (tools.length > 0) body.tools = tools;

      const response = await fetch(DEEPSEEK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${DEEPSEEK_KEY}` },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`DeepSeek ${response.status}: ${err.slice(0, 200)}`);
      }

      const data = await response.json();
      const choice = data.choices?.[0];
      const msg = choice?.message;

      // Si l'IA appelle des outils
      const toolCalls = msg?.tool_calls;
      if (toolCalls && toolCalls.length > 0) {
        remoteLog.info("chat", `Tool calls — round ${round + 1}`, {
          tools: toolCalls.map((t: any) => t.function.name).join(", "),
        });

        // Ajouter le message de l'IA avec les tool_calls
        messages.push({ role: "assistant", content: msg.content || "", tool_calls: toolCalls });

        // Exécuter chaque tool call
        for (const tc of toolCalls) {
          const fn = tc.function;
          let args: any = {};
          try { args = JSON.parse(fn.arguments); } catch { args = {}; }

          const result = await executeToolCall(fn.name, args);
          messages.push({
            role: "tool",
            content: JSON.stringify(result),
            tool_call_id: tc.id,
          } as any);
        }
        continue; // Prochain tour
      }

      // Réponse finale (texte)
      clearTimeout(timeoutId);
      const content = msg?.content || "";
      const elapsed = (Date.now() - startTime) / 1000;

      remoteLog.info("chat", `Réponse — agent: ${agentCfg.label}`, {
        rounds: round + 1,
        elapsedMs: Math.round(elapsed * 1000),
      });

      return parseAIResponse(content, payload.sessionId, agent);
    }

    // Fallback si max tours atteint sans réponse texte
    throw new Error("L'IA n'a pas généré de réponse après plusieurs appels d'outils");
  } catch (error: any) {
    clearTimeout(timeoutId);
    remoteLog.error("chat", `Erreur IA — ${agentCfg.label}`, { error: error.message });
    throw error;
  }
}

function parseAIResponse(content: string, sessionId: string, agent: string): ResponsePayload {
  let parsed: any;
  try {
    const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    parsed = { mode: "text", textFallback: content || "Désolé, je n'ai pas compris." };
  }
  if (parsed.mode === "template" && !parsed.data) parsed.mode = "text";

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
        description: `Généré par ${AGENTS[agent as AgentMode]?.label || agent}`,
        availableActions: ["save", "download", "edit", "pdf"],
        mode: "editable",
        source: "chatMessage",
      },
    },
  };
}
