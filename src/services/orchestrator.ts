// orchestrator.ts — Passe-plat vers chatService (routage auto supprimé)
// L'utilisateur choisit Wari ou Brico dans le sélecteur, l'appel est direct.
// Wari est l'agent par défaut.

import type { MessagePayload, ResponsePayload } from "@/types";
import { remoteLog } from "./loggerService";
import { sendChatRequest } from "./chatService";
import { type AgentMode, DEFAULT_AGENT } from "./agentConfigStore";

export async function orchestrateRequest(
  payload: MessagePayload,
  agent: AgentMode = DEFAULT_AGENT,
): Promise<ResponsePayload> {
  remoteLog.info("orch", `→ ${agent}`, {
    contentLen: payload.message.content?.length || 0,
  });
  return await sendChatRequest(payload, agent);
}
