
import { TemplateType, TemplateData, PDFGenerationResponse } from "@/types";
import { appLogger } from "@/utils/logger";
import { toast } from "@/hooks/use-toast";
import { getDirectDownloadUrl, isGoogleStorageUrl } from "./documentService";

const N8N_PDF_WEBHOOK_URL = import.meta.env.VITE_N8N_PDF_WEBHOOK || "http://localhost:5680/webhook/webhook-pdf";

// Configuration for PDF generation
const PDF_CONFIG = {
  TIMEOUT_MS: 15 * 60 * 1000, // 15 minutes timeout
  MAX_RESPONSE_SIZE: 50 * 1024 * 1024, // 50MB max response
  RETRY_ATTEMPTS: 0, // No automatic retry - single attempt only
};

// Webhook connectivity test
export const testWebhookConnectivity = async (): Promise<{ success: boolean; error?: string; responseTime?: number }> => {
  const startTime = Date.now();
  try {
    appLogger.info("🔗 Testing webhook connectivity", { url: N8N_PDF_WEBHOOK_URL });
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout for connectivity test
    
    const response = await fetch(N8N_PDF_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ test: true, timestamp: new Date().toISOString() }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;
    
    if (response.ok) {
      appLogger.info("✅ Webhook connectivity test successful", { responseTime, status: response.status });
      return { success: true, responseTime };
    } else {
      const errorText = await response.text();
      appLogger.warning("⚠️ Webhook responded with error", { status: response.status, error: errorText, responseTime });
      return { success: false, error: `HTTP ${response.status}: ${errorText}`, responseTime };
    }
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    appLogger.error("❌ Webhook connectivity test failed", { error: errorMessage, responseTime });
    return { success: false, error: errorMessage, responseTime };
  }
};

export const generatePDF = async (
  templateType: TemplateType, 
  data: TemplateData,
  userId: string,
  sessionId: string,
  generationType: "pdf" | "image" = "pdf"
): Promise<PDFGenerationResponse> => {
  const startTime = Date.now();
  let documentNumber = "";
  
  try {
    // Extract document number for better toast messages
    if (templateType === "facture" && "factureNumero" in data) {
      documentNumber = (data as any).factureNumero;
    } else if (templateType === "devis" && "devisNumero" in data) {
      documentNumber = (data as any).devisNumero;
    } else if (templateType === "commande" && "commandeNumero" in data) {
      documentNumber = (data as any).commandeNumero;
    }
    
    // Enhanced logging with more details
    appLogger.info(`🔄 Starting ${generationType} generation for ${templateType}`, { 
      templateType, 
      userId,
      sessionId,
      generationType,
      documentNumber,
      webhookUrl: N8N_PDF_WEBHOOK_URL,
      timeout: `${PDF_CONFIG.TIMEOUT_MS / 1000}s`,
      dataSize: JSON.stringify(data).length,
      dataPreview: JSON.stringify(data).substring(0, 200) + "..."
    });
    
    // Create the request payload for the webhook
    const payload = {
      templateType,
      data,
      userId,
      sessionId,
      generationType,
      timestamp: new Date().toISOString(),
      requestId: `${sessionId}-${Date.now()}` // Add unique request ID for tracking
    };
    
    // Notify the user that generation is in progress
    toast({
      title: `Génération en cours`,
      description: `Création du ${generationType === "pdf" ? "PDF" : "image"} pour ${templateType}${documentNumber ? ` #${documentNumber}` : ''}...`,
      duration: 3000
    });

    // Create AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      appLogger.warning("⏰ PDF generation timeout", { 
        templateType, 
        documentNumber, 
        elapsedTime: `${(Date.now() - startTime) / 1000}s`,
        timeout: `${PDF_CONFIG.TIMEOUT_MS / 1000}s`
      });
    }, PDF_CONFIG.TIMEOUT_MS);

    // Make the request to the n8n webhook with enhanced error handling
    appLogger.info("📤 Sending request to n8n webhook", {
      url: N8N_PDF_WEBHOOK_URL,
      payloadSize: JSON.stringify(payload).length,
      requestId: payload.requestId
    });

    const response = await fetch(N8N_PDF_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "CRM-Template-App/1.0",
        "X-Request-ID": payload.requestId
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;
    
    // Enhanced response handling with detailed logging
    appLogger.info("📥 Webhook response received", {
      status: response.status,
      statusText: response.statusText,
      responseTime: `${responseTime}ms`,
      headers: {
        contentType: response.headers.get('content-type'),
        contentLength: response.headers.get('content-length'),
        server: response.headers.get('server')
      },
      requestId: payload.requestId
    });

    if (!response.ok) {
      let errorDetails = "";
      let errorType = "HTTP_ERROR";
      
      try {
        const errorText = await response.text();
        errorDetails = errorText;
        appLogger.error("❌ Webhook HTTP Error Details", {
          status: response.status,
          statusText: response.statusText,
          errorBody: errorText,
          responseTime: `${responseTime}ms`,
          webhookUrl: N8N_PDF_WEBHOOK_URL,
          requestId: payload.requestId
        });
      } catch (parseError) {
        errorDetails = `Could not parse error response: ${parseError}`;
        errorType = "PARSE_ERROR";
      }

      // Determine error category for better user messaging
      let userMessage = "";
      if (response.status >= 500) {
        userMessage = "Erreur serveur n8n. Le service de génération rencontre des difficultés.";
        errorType = "SERVER_ERROR";
      } else if (response.status === 404) {
        userMessage = "Service de génération non trouvé. Vérifiez la configuration.";
        errorType = "NOT_FOUND";
      } else if (response.status === 400) {
        userMessage = "Données invalides envoyées au service de génération.";
        errorType = "BAD_REQUEST";
      } else if (response.status === 403) {
        userMessage = "Accès refusé au service de génération.";
        errorType = "FORBIDDEN";
      } else {
        userMessage = `Erreur HTTP ${response.status}: ${response.statusText}`;
      }

      toast({
        variant: "destructive",
        title: "Erreur de génération",
        description: `${userMessage}${documentNumber ? ` (Document #${documentNumber})` : ''}`,
      });

      throw new Error(`${errorType}: ${response.status} - ${errorDetails}`);
    }
    
    let responseData;
    try {
      responseData = await response.json();
      appLogger.info("✅ Response data parsed successfully", {
        hasUrl: !!(responseData.pdfUrl || responseData.imageUrl || responseData.url),
        status: responseData.status,
        filename: responseData.filename,
        responseTime: `${responseTime}ms`,
        requestId: payload.requestId
      });
    } catch (jsonError) {
      appLogger.error("❌ Failed to parse JSON response", {
        error: jsonError,
        responseTime: `${responseTime}ms`,
        requestId: payload.requestId
      });
      throw new Error(`JSON_PARSE_ERROR: Unable to parse webhook response - ${jsonError}`);
    }
    
    // Get the original URL from the response
    const originalUrl = responseData.pdfUrl || responseData.imageUrl || responseData.url;
    
    // Generate the direct download URL for Google Storage URLs
    let directDownloadUrl = originalUrl;
    if (originalUrl && isGoogleStorageUrl(originalUrl)) {
      directDownloadUrl = getDirectDownloadUrl(originalUrl, {
        userId,
        templateType,
        filename: responseData.filename  // Utilisation correcte de filename au lieu de fileName
      });
      appLogger.info("🔗 Created direct download URL", {
        originalUrl: originalUrl.substring(0, 100) + "...",
        directDownloadUrl: directDownloadUrl.substring(0, 100) + "..."
      });
    }
    
    appLogger.info(`✅ ${generationType === "pdf" ? "PDF" : "Image"} généré avec succès pour ${templateType}`, { 
      url: originalUrl,
      directDownloadUrl: directDownloadUrl,
      filename: responseData.filename,  // Consistent naming
      status: responseData.status,
      documentNumber
    });

    toast({
      title: `${generationType === "pdf" ? "PDF" : "Image"} généré`,
      description: `${documentNumber ? `Document #${documentNumber}` : 'Votre document'} est prêt à être téléchargé.`,
      duration: 3000
    });

    // Return the standardized response with both URLs
    return {
      success: responseData.status === 'ok',
      url: originalUrl,
      pdfUrl: originalUrl, // Original URL for preview
      downloadUrl: directDownloadUrl, // Direct download URL
      status: responseData.status === 'ok' ? 'success' : 'error',
      filename: responseData.filename,  // Consistent naming 
      templateType: responseData.templateType,
      message: responseData.message,
      documentNumber: documentNumber || undefined
    };
  } catch (error) {
    const errorTime = Date.now() - startTime;
    let errorType = "UNKNOWN_ERROR";
    let userFriendlyMessage = "Une erreur inconnue s'est produite";
    let technicalDetails = "";

    if (error instanceof Error) {
      technicalDetails = error.message;
      
      // Categorize error types for better handling
      if (error.name === 'AbortError') {
        errorType = "TIMEOUT";
        userFriendlyMessage = `Timeout après ${PDF_CONFIG.TIMEOUT_MS / 1000}s - Le service met trop de temps à répondre`;
      } else if (error.message.includes('Failed to fetch') || error.message.includes('Network')) {
        errorType = "NETWORK_ERROR";
        userFriendlyMessage = "Problème de connexion réseau vers le service de génération";
      } else if (error.message.includes('JSON_PARSE_ERROR')) {
        errorType = "RESPONSE_FORMAT_ERROR";
        userFriendlyMessage = "Le service a renvoyé une réponse invalide";
      } else if (error.message.includes('HTTP_ERROR') || error.message.includes('SERVER_ERROR')) {
        errorType = "SERVICE_ERROR";
        userFriendlyMessage = "Le service de génération rencontre des problèmes";
      } else if (error.message.includes('NOT_FOUND')) {
        errorType = "CONFIG_ERROR";
        userFriendlyMessage = "Service de génération non configuré correctement";
      }
    }

    // Enhanced error logging with categorization
    appLogger.error(`❌ PDF Generation Failed - ${errorType}`, {
      templateType,
      generationType,
      documentNumber,
      errorType,
      error: technicalDetails,
      errorTime: `${errorTime}ms`,
      webhookUrl: N8N_PDF_WEBHOOK_URL,
      userId,
      sessionId,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString()
    });

    // Show appropriate user notification
    toast({
      variant: "destructive",
      title: "Échec de génération",
      description: `${userFriendlyMessage}${documentNumber ? ` (Document #${documentNumber})` : ''}`,
      duration: 5000
    });

    return {
      success: false,
      error: technicalDetails,
      errorMessage: userFriendlyMessage,
      errorType,
      status: 'error',
      webhookUrl: N8N_PDF_WEBHOOK_URL, // Include webhook URL for debugging
      responseTime: errorTime
    };
  }
}
