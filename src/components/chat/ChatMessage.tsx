import React, { useState, useEffect } from "react";
import { Message, ResponsePayload, TemplateType, TemplateData } from "@/types";
import { TemplateRenderer } from "@/components/templates";
import { TemplatePreview } from "@/components/templates";
import { TemplateModal } from "@/components/templates";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { FileDown, ShoppingCart, Sparkles, Image as ImageIcon, FileText, AlertTriangle } from "lucide-react";
import TemplateQuoteCard from "@/components/ui/TemplateQuoteCard";
import { QuoteMessage, LoadingMessage } from "@/components/chat";
import { motion, AnimatePresence } from "framer-motion";
import { ActionButtons } from "@/components/templates/ActionButtons";
import { appLogger } from "@/utils/logger";
import { supabase } from "@/integrations/supabase/client";
import { useStreamMarkdown } from "@/hooks/use-stream-markdown";
import { containsMarkdown } from "@/utils/markdown-parser";

interface ChatMessageProps {
  message: Message;
  responsePayload?: ResponsePayload;
  onSaveTemplate?: (data: any) => void;
  onGeneratePDF?: (templateType: TemplateType, data: TemplateData) => void;
  onSendMessage?: (content: string, attachments: File[], template?: { templateType: TemplateType, data: TemplateData }) => void;
  onSetActiveTemplate?: (templateType: TemplateType, data: TemplateData) => void;
  setMessages?: React.Dispatch<React.SetStateAction<Message[]>>;
}

// Helper function to check if a URL is a Supabase Storage URL
const isSupabaseStorageUrl = (url: string): boolean => {
  if (!url) return false;
  // Verify the URL comes from supabase storage domain
  return url.includes('supabase.co/storage/v1/object/public/');
};

// Helper function to check if a file is an image
const isImageType = (url: string): boolean => {
  // If the URL is empty or null, it's not an image
  if (!url) return false;
  
  // Exclude PDFs first - PDFs should not be treated as images
  if (isPdfType(url)) return false;
  
  // Check if the URL comes from Supabase storage
  if (isSupabaseStorageUrl(url)) {
    // Check file extension
    const lowerUrl = url.toLowerCase();
    return lowerUrl.endsWith('.jpg') || 
           lowerUrl.endsWith('.jpeg') || 
           lowerUrl.endsWith('.png') || 
           lowerUrl.endsWith('.gif') || 
           lowerUrl.endsWith('.webp');
  }
  
  // Check if the URL starts with blob: or contains a UUID (temporary)
  if (url.startsWith('blob:')) {
    appLogger.warning('⚠️ Blob URL détectée, elle ne persistera pas:', url);
    return !url.toLowerCase().endsWith('.pdf'); // Assume it's an image if not PDF
  }
  
  // Otherwise check the extension
  const lowerUrl = url.toLowerCase();
  const isImageExtension = 
    lowerUrl.endsWith('.jpg') || 
    lowerUrl.endsWith('.jpeg') || 
    lowerUrl.endsWith('.png') || 
    lowerUrl.endsWith('.gif') || 
    lowerUrl.endsWith('.webp');
  
  return isImageExtension;
};

// Helper function to check if a file is a PDF - improved implementation
const isPdfType = (url: string): boolean => {
  if (!url) return false;
  
  const lowerUrl = url.toLowerCase();
  
  // First priority: check file extension
  if (lowerUrl.endsWith('.pdf')) {
    return true;
  }
  
  // Second priority: check mime type or Content-Type if available
  if (url.includes('type=application/pdf') || url.includes('content-type=application%2Fpdf')) {
    return true;
  }
  
  // For blob URLs, we need to rely on the extension
  if (url.startsWith('blob:') && lowerUrl.includes('.pdf')) {
    appLogger.info('📄 Detected blob PDF URL:', url);
    return true;
  }
  
  return false;
};

// Helper function to check if a file is a video
const isVideoType = (url: string): boolean => {
  if (!url) return false;
  
  // Vérifier si l'URL provient de Supabase storage
  if (isSupabaseStorageUrl(url)) {
    const lowerUrl = url.toLowerCase();
    return lowerUrl.endsWith('.mp4') || 
           lowerUrl.endsWith('.webm') || 
           lowerUrl.endsWith('.ogg') ||
           lowerUrl.endsWith('.mov');
  }
  
  const lowerUrl = url.toLowerCase();
  return lowerUrl.endsWith('.mp4') || 
         lowerUrl.endsWith('.webm') || 
         lowerUrl.endsWith('.ogg') ||
         lowerUrl.endsWith('.mov');
};

const ChatMessage: React.FC<ChatMessageProps> = ({ 
  message, 
  responsePayload,
  onSaveTemplate,
  onGeneratePDF,
  onSendMessage,
  onSetActiveTemplate,
  setMessages
}) => {
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<string | null>(null);
  const [imageLoadError, setImageLoadError] = useState<Record<string, boolean>>({});
  
  const isUserMessage = message.isUser;
  
  // Déterminer s'il s'agit d'une réponse de template, soit par responsePayload, soit par message.template
  const isTemplateResponse = responsePayload?.response.mode === "template" || !!message.template;
  
  // Apply streaming animation only for non-user messages (agent responses) that are not templates
  const shouldStreamText = !isUserMessage && !isTemplateResponse && !message.content.startsWith("__QUOTE_CARD__");
  
  // Detect if the message content contains markdown
  const hasMarkdown = !isUserMessage && containsMarkdown(message.content);
  
  // Use the streaming markdown hook for animating text with markdown support
  const { streamedText, isComplete, StreamedComponent } = useStreamMarkdown({
    text: message.content,
    isStreaming: shouldStreamText,
    speed: 15,
    disableMarkdown: !hasMarkdown, // Only use markdown rendering if we detect markdown patterns
  });
  
  // Log pour le debugging des messages
  useEffect(() => {
    console.log("📝 ChatMessage - message:", 
      JSON.stringify({
        id: message.id,
        content: message.content.substring(0, 50) + (message.content.length > 50 ? "..." : ""),
        isUser: message.isUser,
        hasTemplate: !!message.template,
        templateType: message.template?.templateType,
        hasResponsePayload: !!responsePayload,
        responsePayloadMode: responsePayload?.response.mode,
        hasAttachments: message.attachments?.length > 0
      }, null, 2));
    
    if (message.template) {
      console.log("🧩 Message contient un template:", 
        message.template.templateType, 
        JSON.stringify(message.template.data, null, 2).substring(0, 200) + "...");
    }

    if (message.attachments && message.attachments.length > 0) {
      console.log("📎 Message contient des pièces jointes:", message.attachments);
    }
    
    if (responsePayload) {
      console.log("📊 ResponsePayload:", 
        JSON.stringify({
          mode: responsePayload.response.mode,
          hasTemplateType: 'templateType' in responsePayload.response,
          hasData: 'data' in responsePayload.response,
          templateType: 'templateType' in responsePayload.response ? responsePayload.response.templateType : null
        }, null, 2));
    }
  }, [message, responsePayload]);

  // Vérifier que la réponse est de type template avant d'accéder aux propriétés
  const hasTemplateTypeAndData = 
    (responsePayload && 
     responsePayload.response.mode === "template" && 
     'templateType' in responsePayload.response && 
     'data' in responsePayload.response) ||
    (message.template !== undefined);
  
  // Extraire les informations du template (soit de responsePayload, soit de message.template)
  const templateType = responsePayload?.response.mode === "template" && 'templateType' in responsePayload.response
    ? responsePayload.response.templateType
    : message.template?.templateType;
  
  const templateData = responsePayload?.response.mode === "template" && 'data' in responsePayload.response
    ? responsePayload.response.data
    : message.template?.data;
  
  const textFallback = responsePayload?.response.mode === "template" && 'textFallback' in responsePayload.response
    ? responsePayload.response.textFallback
    : message.content;
    
  const isFactureTemplate = templateType === "facture";
  const isQuoteCard = message.content.startsWith("__QUOTE_CARD__");
  const hasAttachments = message.attachments && message.attachments.length > 0;

  // Si c'est une carte de citation, extraire les informations
  let quoteCardData = null;
  if (isQuoteCard) {
    try {
      const jsonString = message.content.replace("__QUOTE_CARD__", "");
      quoteCardData = JSON.parse(jsonString);
      console.log("🃏 QuoteCard extraite:", quoteCardData);
    } catch (error) {
      console.error("Erreur lors de l'analyse des données de citation", error);
    }
  }

  const handleOpenTemplate = () => {
    console.log("🖱️ Ouverture du template modal pour le message ID:", message.id);
    setIsTemplateModalOpen(true);
  };

  const handleCloseTemplate = () => {
    setIsTemplateModalOpen(false);
  };

  const handleSaveTemplate = (data: any) => {
    if (onSaveTemplate) {
      onSaveTemplate(data);
    }
    setIsTemplateModalOpen(false);
  };

  const handleGeneratePDF = () => {
    if (onGeneratePDF && templateType && templateData) {
      onGeneratePDF(templateType, templateData);
    }
  };

  const handleCommanderClick = () => {
    if (onSendMessage && templateType === "facture" && templateData) {
      const factureData = templateData as any;
      const factureNumero = factureData.factureNumero || "N/A";
      const total = factureData.total ? `${factureData.total.toFixed(2)} €` : "0.00 €";
      const clientNom = factureData.client?.nom || "Client";
      
      // Créer les données pour la carte de citation
      const quoteData = {
        templateType: "facture",
        clientName: clientNom,
        montant: factureData.total || 0,
        templateId: factureNumero,
        additionalText: "Génère une commande basé sur les détails de cette facture. Ajoutez tous les items de la facture liée."
      };
      
      // Sérialiser en JSON et préfixer pour identifier comme carte de citation
      const quoteMessage = `__QUOTE_CARD__${JSON.stringify(quoteData)}`;
      
      // Envoyer le message comme un message utilisateur
      onSendMessage(quoteMessage, [], {
        templateType: templateType,
        data: templateData
      });
    }
  };

const handleCreateCahierDesCharges = () => {
  if (onSendMessage && templateType === "commande" && templateData) {
    const cmdData = templateData as any;
    const commandeId = cmdData.commandeNumero || "N/A";
    const clientNom = cmdData.client?.nom || "Client";

    // Créer les données pour la carte de cahier des charges
    const quoteData = {
      templateType: "commande",
      numero: commandeId,
      client: clientNom,
      additionalText: "Génère un cahier des charges basé sur les détails de cette commande.Recherchez les informations de nomenclature des articles de cette commandes."
    };

    // Sérialiser en JSON et préfixer pour identifier comme carte de citation
    const quoteMessage = `__QUOTE_CARD__${JSON.stringify(quoteData)}`;

    // Envoyer le message comme un message utilisateur
    onSendMessage(quoteMessage, [], {
      templateType: "commande",
      data: templateData
    });
  }
};



  const handleAskAI = () => {
    if (onSetActiveTemplate && templateType && templateData) {
      // Log pour déboguer
      console.log("ChatMessage: handleAskAI appelé avec template data:", templateData);
      
      // Utiliser le template complet
      onSetActiveTemplate(templateType, templateData);
    }
  };

  // Fonction pour déléguer au parent via onSetActiveTemplate
  const handleTemplateAskAI = (templateType: TemplateType, data: TemplateData) => {
    if (onSetActiveTemplate) {
      onSetActiveTemplate(templateType, data);
    }
  };

  // Gérer l'ouverture d'une pièce jointe
  const handleAttachmentClick = (url: string) => {
    setPreviewAttachment(url);
  };

  // Fermer la prévisualisation de pièce jointe
  const handleClosePreview = () => {
    setPreviewAttachment(null);
  };

  // Gérer les erreurs de chargement d'image
  const handleImageError = (url: string) => {
    setImageLoadError(prev => ({ ...prev, [url]: true }));
    console.error("Erreur de chargement d'image:", url);
  };

  // Rendu des pièces jointes
  const renderAttachments = () => {
    if (!hasAttachments) return null;

    return (
      <div className="flex flex-wrap gap-2 mb-2">
        {message.attachments.map((url, index) => {
          console.log("Rendering attachment:", url, "isImageType:", isImageType(url));
          
          // Vérifier si l'image est déjà en erreur
          const hasError = imageLoadError[url];
          
          if (isImageType(url) && !hasError) {
            return (
              <div 
                key={index} 
                className="relative cursor-pointer"
                onClick={() => handleAttachmentClick(url)}
              >
                <img 
                  src={url} 
                  alt={`Pièce jointe ${index + 1}`}
                  className="max-h-[200px] max-w-full rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow" 
                  onError={() => handleImageError(url)}
                />
              </div>
            );
          } else if (hasError) {
            return (
              <div 
                key={index} 
                className="flex items-center justify-center p-3 bg-gray-100 rounded-lg border border-gray-200 shadow-sm transition-shadow cursor-not-allowed"
              >
                <div className="flex flex-col items-center">
                  <AlertTriangle className="w-8 h-8 text-yellow-500" />
                  <span className="text-xs text-gray-600 mt-1">Image non disponible</span>
                </div>
              </div>
            );
          } else if (isVideoType(url)) {
            return (
              <div 
                key={index} 
                className="relative cursor-pointer max-w-[200px]"
                onClick={() => handleAttachmentClick(url)}
              >
                <video 
                  className="max-h-[200px] w-full rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow" 
                  controls={false}
                >
                  <source src={url} />
                  Votre navigateur ne prend pas en charge la vidéo.
                </video>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-white/50 backdrop-blur-sm p-2 rounded-full">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-800">
                      <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                  </div>
                </div>
              </div>
            );
          } else if (isPdfType(url)) {
            // Pour les PDF, afficher une carte avec le nom du fichier
            const fileName = url.split('/').pop() || 'Document PDF';
            return (
              <div 
                key={index} 
                className="flex items-center justify-center p-3 bg-gray-100 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleAttachmentClick(url)}
              >
                <div className="flex flex-col items-center">
                  <FileText className="w-8 h-8 text-red-500" />
                  <span className="text-xs text-gray-600 mt-1">{fileName}</span>
                </div>
              </div>
            );
          } else {
            return (
              <div 
                key={index}
                className="flex items-center justify-center w-32 h-32 bg-gray-100 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
              >
                <a 
                  href={url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex flex-col items-center text-center px-2"
                >
                  <FileDown className="w-8 h-8 text-gray-500" />
                  <span className="text-xs text-gray-600 mt-1 truncate max-w-[95%]">
                    {url.split('/').pop() || 'Télécharger'}
                  </span>
                </a>
              </div>
            );
          }
        })}
      </div>
    );
  };

  return (
    <>
      {/* Modal de prévisualisation */}
      {previewAttachment && (
        <div 
          className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-4"
          onClick={handleClosePreview}
        >
          <div className="max-w-4xl w-full max-h-[90vh] relative" onClick={e => e.stopPropagation()}>
            {isImageType(previewAttachment) && !imageLoadError[previewAttachment] ? (
              <img 
                src={previewAttachment} 
                alt="Prévisualisation" 
                className="w-full h-auto object-contain max-h-[80vh] rounded-lg"
                onError={() => handleImageError(previewAttachment)}
              />
            ) : isVideoType(previewAttachment) ? (
              <video 
                src={previewAttachment}
                controls
                autoPlay
                className="w-full h-auto max-h-[80vh] rounded-lg"
              >
                Votre navigateur ne prend pas en charge la vidéo.
              </video>
            ) : isPdfType(previewAttachment) ? (
              <iframe 
                src={previewAttachment} 
                title="PDF Viewer" 
                className="w-full h-[80vh] rounded-lg bg-white"
              />
            ) : (
              <div className="flex flex-col items-center justify-center bg-white p-8 rounded-lg">
                <AlertTriangle className="w-16 h-16 text-yellow-500 mb-4" />
                <p className="text-lg font-medium">Impossible d'afficher ce contenu</p>
                <a 
                  href={previewAttachment} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="mt-4 px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-700 transition-colors"
                >
                  Télécharger le fichier
                </a>
              </div>
            )}
            <button 
              className="absolute top-2 right-2 bg-white rounded-full p-1 shadow-lg"
              onClick={handleClosePreview}
              aria-label="Fermer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
      )}

      <div 
        className={`flex ${isUserMessage ? 'justify-end' : 'justify-start'} mb-3 animate-fadeIn min-w-0`}
      >
        <div className={`max-w-[85%]`}>
          {isQuoteCard && quoteCardData ? (
            <div>
              <QuoteMessage
                templateType={quoteCardData.templateType}
                numero={quoteCardData.templateId || quoteCardData.numero}
                client={quoteCardData.clientName || quoteCardData.client}
                montant={quoteCardData.montant}
                title={quoteCardData.title}
                onClick={handleOpenTemplate}
                className={`${isUserMessage ? 'ml-auto' : ''}`}
              />
              <div 
                className={`
                  rounded-xl shadow-sm px-4 py-2 break-words whitespace-pre-wrap mt-1
                  ${isUserMessage 
                    ? 'bg-orange-100 text-orange-900 rounded-br-none' 
                    : 'bg-gray-100 text-gray-800 rounded-bl-none'
                  }
                `}
                style={{ overflowWrap: 'break-word' }}
              >
                {quoteCardData.additionalText || ""}
              </div>
              <div className="text-xs text-gray-500 mt-1 px-1">
                {format(new Date(message.timestamp), "HH:mm", { locale: fr })}
              </div>
            </div>
          ) : (
            <div>
              {/* Affichage des pièces jointes au-dessus du contenu du message */}
              {hasAttachments && renderAttachments()}
              
              <div className={`
                rounded-xl shadow-sm px-4 py-2 break-words whitespace-pre-wrap
                ${isUserMessage 
                  ? 'bg-orange-100 text-orange-900 rounded-br-none' 
                  : 'bg-gray-100 text-gray-800 rounded-bl-none'
                }
                ${isTemplateResponse ? 'p-0 bg-transparent shadow-none' : ''}
                ${hasAttachments && !message.content ? 'hidden' : ''}
              `}>
                {isTemplateResponse && hasTemplateTypeAndData && templateType && templateData ? (
                  <div className="my-2 w-full max-w-full">
                    {textFallback && (
                      <div className="bg-gray-100 text-gray-800 rounded-xl rounded-bl-none px-4 py-2 mb-3 shadow-sm break-words whitespace-pre-wrap" style={{ overflowWrap: 'break-word' }}>
                        {shouldStreamText ? <StreamedComponent /> : textFallback}
                      </div>
                    )}
                    <div className="mt-2 w-full max-w-full">
                      <TemplatePreview
                        templateType={templateType}
                        data={templateData}
                        metadata={{
                          displayName: templateType.charAt(0).toUpperCase() + templateType.slice(1),
                          description: "Template généré par l'IA",
                          availableActions: ['save', 'download'],
                          mode: 'editable',
                          source: 'chatMessage'
                        }}
                        onClick={handleOpenTemplate}
                      />
                    </div>
                    
                    <ActionButtons
                      templateType={templateType}
                      onAskAI={handleAskAI}
                      onCommander={isFactureTemplate ? handleCommanderClick : undefined}
                      onGeneratePDF={onGeneratePDF ? () => handleGeneratePDF() : undefined}
                      onCreateCahierDesCharges={templateType === "commande" ? handleCreateCahierDesCharges : undefined}
                    />
                    
                    {isTemplateModalOpen && templateType && templateData && (
                      <TemplateModal
                        isOpen={isTemplateModalOpen}
                        onClose={handleCloseTemplate}
                        messageId={message.id}
                        templateType={templateType}
                        data={templateData}
                        metadata={{
                          displayName: templateType.charAt(0).toUpperCase() + templateType.slice(1),
                          description: "Template généré par l'IA",
                          availableActions: ['save', 'download'],
                          mode: 'editable',
                          source: 'chatMessage'
                        }}
                        setMessages={setMessages}
                        onSave={handleSaveTemplate}
                        onGeneratePDF={onGeneratePDF}
                        onAskAI={handleTemplateAskAI}
                      />
                    )}
                  </div>
                ) : (
                  <div>
                    {shouldStreamText ? <StreamedComponent /> : message.content}
                  </div>
                )}
              </div>
              
              {!isQuoteCard && (
                <div className="text-xs text-gray-500 mt-1 px-1">
                  {format(new Date(message.timestamp), "HH:mm", { locale: fr })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ChatMessage;
