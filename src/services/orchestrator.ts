// orchestrator.ts — Orchestrateur multi-agent (Auto → Wari/Brico)
// Remplace l'appel direct à sendChatRequest par une logique de routage
import type { MessagePayload, ResponsePayload } from "@/types";
import { remoteLog } from "./loggerService";
import { sendChatRequest } from "./chatService";
import type { AgentMode } from "./agentPrompts";

/**
 * Orchestre l'appel : si agent=auto, route vers Wari ou Brico.
 * Si l'agent délégué a besoin de l'autre agent, forward automatiquement.
 */
export async function orchestrateRequest(
  payload: MessagePayload,
  agent: AgentMode = "auto",
): Promise<ResponsePayload> {
  const startTime = Date.now();
  const userMessage = payload.message.content || "";

  remoteLog.info("orch", `Orchestration — agent: ${agent}`, {
    contentLen: userMessage.length,
  });

  // Si l'utilisateur a choisi manuellement un agent, on l'utilise directement
  if (agent !== "auto") {
    remoteLog.info("orch", `→ Délégation directe à ${agent}`);
    return await sendChatRequest(payload, agent);
  }

  // === ROUTAGE AUTO ===
  // L'agent Auto analyse le message et choisit Wari ou Brico
  const routePayload: MessagePayload = {
    ...payload,
    message: {
      ...payload.message,
      content: `Analyse cette demande et réponds UNIQUEMENT par le mot "wari" ou "brico" selon qui doit traiter la demande :\n\n${userMessage}`,
    },
  };

  try {
    const routeResponse = await sendChatRequest(routePayload, "auto");
    const routeText = (routeResponse.response.textFallback || "").toLowerCase().trim();

    let targetAgent: AgentMode = "wari"; // fallback

    if (routeText.includes("brico")) {
      targetAgent = "brico";
    } else if (routeText.includes("wari")) {
      targetAgent = "wari";
    } else {
      // Ambigu : on demande des précisions à l'utilisateur
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
          metadata: {
            displayName: "Précision",
            description: "L'assistant a besoin de précisions",
            source: "chatMessage",
          },
        },
      };
    }

    remoteLog.info("orch", `→ Auto route vers ${targetAgent}`, {
      elapsed_ms: Date.now() - startTime,
      route_text: routeText,
    });

    // Déléguer à l'agent cible
    const response = await sendChatRequest(payload, targetAgent);

    // Si la réponse est un template technique mais qu'on est passé par Wari,
    // on pourrait forwarder à Brico. Pour l'instant, on retourne tel quel.
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
