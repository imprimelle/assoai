// hermesRouter.ts — Client HTTP pour l'API Hermes locale
// Remplace orchestrator.ts — route les messages vers le bon profil Hermes

import type { MessagePayload, ResponsePayload } from "@/types";
import type { AgentMode } from "@/services/agentConfigStore";
import { detectPageContext, routeToProfile, getSkillsForContext } from "./pageContextDetector";

const HERMES_API_URL = ""; // URLs absolues car proxy nginx gère le /hermes/

export interface HermesRouteRequest {
  message: string;
  userId: string;
  sessionId: string;
  projectId?: string;
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
  const forcedAgent = agent === 'brico' ? 'brico' : agent === 'pm' ? 'pm' : undefined;
  const pageContext = detectPageContext(forcedAgent);
  const profile = routeToProfile(pageContext);

  const request: HermesRouteRequest = {
    message: payload.message.content,
    userId: payload.userId,
    sessionId: payload.sessionId,
    projectId: (payload as any).projectId,
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
    const response = await fetch(`/hermes/health`);
    return response.ok;
  } catch {
    return false;
  }
}

// ============================================================
// STREAMING SSE — Réponses temps réel avec callbacks
// ============================================================

export interface StreamCallbacks {
  onChunk?: (text: string) => void;
  onDone?: (response: ResponsePayload) => void;
  onError?: (error: string) => void;
}

/**
 * Route un message en streaming SSE.
 * Appelle onChunk pour chaque morceau de texte reçu,
 * puis onDone avec la réponse finale parsée.
 */
export async function routeMessageStream(
  payload: MessagePayload,
  agent: AgentMode = 'wari',
  callbacks: StreamCallbacks
): Promise<void> {
  const forcedAgent = agent === 'brico' ? 'brico' : agent === 'pm' ? 'pm' : undefined;
  const pageContext = detectPageContext(forcedAgent);
  const profile = routeToProfile(pageContext);

  console.log(`[hermesRouter:stream] → ${profile} (page: ${pageContext.pageType})`);

  try {
    const response = await fetch(`${HERMES_API_URL}/hermes/router/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: payload.message.content,
        userId: payload.userId,
        sessionId: payload.sessionId,
        profile,
        skills: getSkillsForContext(pageContext),
        attachedTemplate: payload.message.template,
        attachedQuote: payload.message.quote,
      }),
    });

    if (!response.ok) {
      throw new Error(`Hermes API error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parser les événements SSE (format: data: {...}\n\n)
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || ''; // Garder le dernier fragment incomplet

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const jsonStr = line.slice(6); // Enlever 'data: '
          const event = JSON.parse(jsonStr);

          if (event.error) {
            callbacks.onError?.(event.error);
            return;
          }

          if (event.done) {
            // Réponse finale — parser comme ResponsePayload
            const result: ResponsePayload = {
              agentId: event.profile || profile,
              sessionId: payload.sessionId,
              timestamp: new Date().toISOString(),
              response: event.response || {
                mode: 'text',
                textFallback: fullText || 'Aucune réponse.',
              },
            };
            callbacks.onDone?.(result);
            return;
          }

          if (event.chunk) {
            fullText += event.chunk;
            callbacks.onChunk?.(event.chunk);
          }
        } catch {
          // Ignorer les lignes mal formées
        }
      }
    }

    // Si la boucle se termine sans événement done, appeler onDone avec le texte accumulé
    callbacks.onDone?.({
      agentId: profile,
      sessionId: payload.sessionId,
      timestamp: new Date().toISOString(),
      response: {
        mode: 'text',
        textFallback: fullText || 'Aucune réponse.',
      },
    });

  } catch (error: any) {
    console.error('[hermesRouter:stream] Error:', error);
    callbacks.onError?.(error.message || 'Erreur de streaming');
  }
}
