import { MessagePayload, ResponsePayload } from "@/types";
import { appLogger } from "@/utils/logger";

// Configuration for webhook URLs (via env vars)
const WEBHOOK_CHAT_URL = import.meta.env.VITE_N8N_CHAT_WEBHOOK || 'http://localhost:5680/webhook/webhook-chat-receiver';
const WEBHOOK_PDF_URL = import.meta.env.VITE_N8N_PDF_WEBHOOK || 'http://localhost:5680/webhook/webhook-pdf';

// Adaptive timeout configuration - augmenté pour les projets
const getTimeoutForContext = (sessionId: string): number => {
  // Project sessions get longer timeouts - 30 minutes
  if (sessionId.startsWith('project_')) {
    return 30 * 60 * 1000; // 30 minutes for project generations
  }
  return 15 * 60 * 1000; // 15 minutes for chat sessions
};

// Determine message payload type based on content
export const determineMessagePayloadType = (hasText: boolean, hasAttachments: boolean, hasTemplate: boolean): string => {
  if (hasTemplate && hasText) return "template_with_text";
  if (hasTemplate) return "template";
  if (hasAttachments && hasText) return "attachment_with_text";
  if (hasAttachments) return "attachment";
  return "text";
};

// Heartbeat function to maintain connection - plus fréquent pour les projets
const sendHeartbeat = async (controller: AbortController, sessionId: string): Promise<void> => {
  const heartbeatInterval = sessionId.startsWith('project_') ? 15000 : 30000; // 15s pour projets, 30s pour chat
  
  const interval = setInterval(() => {
    if (controller.signal.aborted) {
      clearInterval(interval);
      return;
    }
    
    // Simple connectivity check
    fetch('/api/heartbeat', { 
      method: 'GET',
      signal: controller.signal 
    }).catch(() => {
      // Ignore heartbeat failures
    });
  }, heartbeatInterval);
  
  // Cleanup on abort
  controller.signal.addEventListener('abort', () => {
    clearInterval(interval);
  });
};

export const sendMessageToWebhook = async (payload: MessagePayload): Promise<ResponsePayload> => {
  const startTime = Date.now();
  const timeoutMs = getTimeoutForContext(payload.sessionId);
  
  appLogger.info('🚀 Webhook - Début de la requête', {
    url: WEBHOOK_CHAT_URL,
    sessionId: payload.sessionId,
    userId: payload.userId,
    messageType: payload.message.type,
    timeout: `${timeoutMs / 1000}s`,
    hasTemplate: !!payload.message.template,
    hasQuote: !!payload.message.quote
  });

  // Create abort controller with adaptive timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  // Start heartbeat to maintain connection
  sendHeartbeat(controller, payload.sessionId);

  try {
    // Compress payload if large
    const payloadSize = JSON.stringify(payload).length;
    if (payloadSize > 100000) { // 100KB threshold
      appLogger.info('📦 Webhook - Payload volumineux détecté', {
        size: `${Math.round(payloadSize / 1024)}KB`,
        sessionId: payload.sessionId
      });
    }

    const response = await fetch(WEBHOOK_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Lovable-WebApp/1.0',
        'X-Session-ID': payload.sessionId,
        'X-Request-ID': `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    
    const elapsedTime = (Date.now() - startTime) / 1000;

    if (!response.ok) {
      const errorText = await response.text();
      
      appLogger.error('❌ Webhook - Erreur HTTP', {
        status: response.status,
        statusText: response.statusText,
        errorText,
        elapsedTime: `${elapsedTime}s`,
        sessionId: payload.sessionId
      });

      throw new Error(`Webhook error: ${response.status} ${response.statusText}`);
    }

    const responseData: ResponsePayload = await response.json();
    
    appLogger.info('✅ Webhook - Succès', {
      elapsedTime: `${elapsedTime}s`,
      responseMode: responseData.response?.mode,
      hasData: !!responseData.response?.data,
      sessionId: payload.sessionId,
      agentId: responseData.agentId
    });

    return responseData;

  } catch (error: any) {
    clearTimeout(timeoutId);
    const elapsedTime = (Date.now() - startTime) / 1000;
    
    // Enhanced error categorization
    const isAbortError = error instanceof DOMException && error.name === 'AbortError';
    const isNetworkError = error instanceof TypeError && error.message.includes('Failed to fetch');
    const isTimeoutError = isAbortError || elapsedTime >= (timeoutMs / 1000 - 1);
    
    appLogger.error('❌ Webhook - Erreur lors de la requête', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      isAbort: isAbortError,
      isNetwork: isNetworkError,
      isTimeout: isTimeoutError,
      elapsedTime: `${elapsedTime}s`,
      sessionId: payload.sessionId,
      userId: payload.userId,
      messageType: payload.message.type
    });

    // Re-throw with enhanced error information
    const enhancedError = new Error(error.message);
    (enhancedError as any).isAbort = isAbortError;
    (enhancedError as any).isNetwork = isNetworkError;
    (enhancedError as any).isTimeout = isTimeoutError;
    (enhancedError as any).elapsedTime = elapsedTime;
    (enhancedError as any).sessionId = payload.sessionId;
    
    throw enhancedError;
  }
};

export const sendPDFGenerationRequest = async (pdfPayload: any): Promise<any> => {
  const startTime = Date.now();
  const timeoutMs = 15 * 60 * 1000; // 15 minutes for PDF generation
  
  appLogger.info('🎯 PDF Webhook - Début de la génération', {
    url: WEBHOOK_PDF_URL,
    templateType: pdfPayload.templateType,
    userId: pdfPayload.userId,
    sessionId: pdfPayload.sessionId
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(WEBHOOK_PDF_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Lovable-WebApp/1.0',
        'X-Session-ID': pdfPayload.sessionId
      },
      body: JSON.stringify(pdfPayload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const elapsedTime = (Date.now() - startTime) / 1000;

    if (!response.ok) {
      const errorText = await response.text();
      
      appLogger.error('❌ PDF Webhook - Erreur HTTP', {
        status: response.status,
        statusText: response.statusText,
        errorText,
        elapsedTime: `${elapsedTime}s`
      });

      throw new Error(`PDF Webhook error: ${response.status} ${response.statusText}`);
    }

    const responseData = await response.json();
    
    appLogger.info('✅ PDF Webhook - Succès', {
      elapsedTime: `${elapsedTime}s`,
      hasDownloadUrl: !!responseData.downloadUrl
    });

    return responseData;

  } catch (error: any) {
    clearTimeout(timeoutId);
    const elapsedTime = (Date.now() - startTime) / 1000;
    
    appLogger.error('❌ PDF Webhook - Erreur lors de la génération', {
      error: error.message,
      elapsedTime: `${elapsedTime}s`,
      templateType: pdfPayload.templateType
    });

    throw error;
  }
};
