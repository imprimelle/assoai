// hermesRouter.ts — Client HTTP pour l'API Hermes locale
// Remplace orchestrator.ts — route les messages vers le bon profil Hermes

import type { MessagePayload, ResponsePayload } from "@/types";
import type { AgentMode } from "@/services/agentConfigStore";
import { detectPageContext, routeToProfile, getSkillsForContext } from "./pageContextDetector";

const HERMES_API_URL = "http://localhost:11434";

export interface HermesRouteRequest {
  message: string;
  userId: string;
  sessionId: string;
  pageContext: ReturnType<typeof detectPageContext>;
  attachedTemplate?: MessagePayload['message']['template'];
  attachedQuote?: MessagePayload['message']['quote'];
}

export interface HermesRouteResponse {
  success: boolean;
  profile: string;
  response: ResponsePayload['response'];
  tokens?: number;
  skillsUsed?: string[];
  error?: string;
}

/**
 * Route un message vers le profil Hermes approprié.
 * Appelé par ChatContainer.handleSendMessage().
 */
export async function routeMessage(
  payload: MessagePayload,
  agent: AgentMode = 'wari'
): Promise<ResponsePayload> {
  const pageContext = detectPageContext(agent === 'brico' ? 'brico' : undefined);
  const profile = routeToProfile(pageContext);

  const request: HermesRouteRequest = {
    message: payload.message.content,
    userId: payload.userId,
    sessionId: payload.sessionId,
    pageContext,
    attachedTemplate: payload.message.template,
    attachedQuote: payload.message.quote,
  };

  console.log(`[hermesRouter] → ${profile} (page: ${pageContext.pageType})`);

  try {
    const response = await fetch(`${HERMES_API_URL}/hermes/router`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...request,
        profile,
        skills: getSkillsForContext(pageContext),
      }),
    });

    if (!response.ok) {
      throw new Error(`Hermes API error: ${response.status} ${response.statusText}`);
    }

    const data: HermesRouteResponse = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Hermes routing failed');
    }

    return {
      agentId: data.profile,
      sessionId: payload.sessionId,
      timestamp: new Date().toISOString(),
      response: data.response,
    };
  } catch (error) {
    console.error('[hermesRouter] Error:', error);
    
    // Fallback: retourne une réponse textuelle d'erreur
    return {
      agentId: 'hermes-wari',
      sessionId: payload.sessionId,
      timestamp: new Date().toISOString(),
      response: {
        mode: 'text',
        textFallback: `Désolé, je rencontre un problème technique. L'API Hermes n'est pas accessible pour le moment. Veuillez réessayer dans quelques instants.`,
      },
    };
  }
}

/**
 * Vérifie si l'API Hermes est accessible.
 */
export async function checkHermesHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${HERMES_API_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}
