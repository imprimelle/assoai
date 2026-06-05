// orchestrator.ts — Routage simple : Auto → Wari ou Brico
// Auto analyse la demande et répond "wari" ou "brico", puis l'agent cible traite avec ses données injectées

import type { MessagePayload, ResponsePayload } from "@/types";
import { remoteLog } from "./loggerService";
import { sendChatRequest } from "./chatService";
import { type AgentMode, DEFAULT_AGENT } from "./agentConfigStore";

/**
 * Orchestre l'appel :
 * - Si agent != "auto" → délégation directe
 * - Si agent = "auto" → Auto analyse → délègue à Wari ou Brico
 */
export async function orchestrateRequest(
  payload: MessagePayload,
  agent: AgentMode = DEFAULT_AGENT,
): Promise<ResponsePayload> {
  const startTime = Date.now();
  const userMessage = payload.message.content || "";

  remoteLog.info("orch", `Orchestration — agent: ${agent}`, {
    contentLen: userMessage.length,
  });

  // Agent manuel → direct
  if (agent !== "auto") {
    remoteLog.info("orch", `→ Délégation directe à ${agent}`);
    return await sendChatRequest(payload, agent);
  }

  // === ROUTAGE AUTO ===
  // L'agent Auto analyse le message et répond "wari" ou "brico"
  const routePayload: MessagePayload = {
    ...payload,
    message: {
      ...payload.message,
      content: userMessage,
    },
  };

  try {
    const routeResponse = await sendChatRequest(routePayload, "auto");
    const routeText = (routeResponse.response.textFallback || "")
      .toLowerCase()
      .trim();

    let targetAgent: AgentMode = "wari"; // fallback

    if (routeText.includes("brico")) {
      targetAgent = "brico";
    } else if (routeText.includes("wari")) {
      targetAgent = "wari";
    } else {
      // Ambigu : demande de précision
      remoteLog.info("orch", "→ Route ambiguë, demande de précision");
      return {
        agentId: "assoai-auto",
        sessionId: payload.sessionId,
        timestamp: new Date().toISOString(),
        response: {
          mode: "text",
          textFallback:
            "Je ne suis pas sûr de comprendre. Voulez-vous :\n" +
            "• **Un devis, une facture ou une commande** ? (je passerai par Wari, l'assistant commercial)\n" +
            "• **Un cahier des charges technique ou des informations sur la fabrication** ? (je passerai par Brico, l'ingénieur)",
        } as any,
      };
    }

    remoteLog.info("orch", `→ Auto route vers ${targetAgent}`, {
      elapsed_ms: Date.now() - startTime,
    });

    // Déléguer à l'agent cible (avec données injectées)
    const response = await sendChatRequest(payload, targetAgent);

    const totalMs = Date.now() - startTime;
    remoteLog.info("orch", `✅ Orchestration terminée (${totalMs}ms)`, {
      agent: targetAgent,
      mode: response.response.mode,
      templateType: response.response.templateType,
    });

    return response;
  } catch (error: any) {
    remoteLog.error("orch", `Erreur orchestration`, { error: error.message });
    throw error;
  }
}
