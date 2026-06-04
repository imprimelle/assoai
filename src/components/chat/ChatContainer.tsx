import React, { useState, useRef, useEffect, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { 
  Message, 
  ResponsePayload, 
  MessagePayload,
  MessagePayloadType,
  User,
  PromptGuidelines,
  TemplateType,
  TemplateData,
  TemplateMetadata,
  PDFAction,
  MessageType,
  FactureData,
  DevisData,
  CommandeData,
  CahierDesChargesData
} from "@/types";
import { orchestrateRequest } from "@/services/orchestrator";
import { generatePDFClient } from "@/services/pdfGenerator";
import { determineMessagePayloadType } from "@/services/webhook";
import type { AgentMode } from "@/services/agentPrompts";
import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from "uuid";
import ChatMessage from "./ChatMessage";
import MessageInput from "./MessageInput";
import TemplateSelector from "../templates/TemplateSelector";
import PDFActionMessage from "./PDFActionMessage";
import { PlusCircle, X, Menu, Play } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNavigate } from "react-router-dom";
import { TemplateModal } from "@/components/templates";
import { useMessages } from "@/hooks/use-messages";
import { buildQuoteData } from "@/utils/quote-utils";
import { appLogger } from "@/utils/logger";
// Ajoutez ceci parmi vos imports existants
import { getLastTemplateVersion } from "@/services/database";
import { LoadingMessage, ScrollToBottomButton } from "@/components/chat";

interface ChatContainerProps {
  user: User;
  persistentSessionId?: string;
}

const ChatContainer: React.FC<ChatContainerProps> = ({ user, persistentSessionId }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<{
    templateType: TemplateType;
    data: TemplateData;
  } | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [currentTemplateData, setCurrentTemplateData] = useState<{
    templateType: TemplateType;
    data: TemplateData;
    metadata?: TemplateMetadata;
  } | null>(null);
  const [pdfActions, setPdfActions] = useState<PDFAction[]>([]);
  const [activeAgent, setActiveAgent] = useState<AgentMode>("auto");
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  
  // Générer un ID de session unique ou utiliser celui fourni
  const sessionId = useRef<string>(persistentSessionId?.trim() || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  
  // Utiliser le hook useMessages pour gérer les messages
  const { messages, isLoading: isLoadingMessages, addMessage, payloads, updatePayload, setMessages } = useMessages({
    sessionId: sessionId.current
  });

  const [showScrollButton, setShowScrollButton] = useState(false);
  
  // Défiler vers le bas lorsque de nouveaux messages sont ajoutés
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages, pdfActions]);

  // Message de bienvenue automatique si aucun message n'existe
  useEffect(() => {
    // Ne pas ajouter le message de bienvenue si on est en train de charger les messages ou s'il y a déjà des messages
    if (!isLoadingMessages && messages.length === 0) {
      const welcomeMessage: Message = {
        id: `welcome_${Date.now()}`,
        sessionId: sessionId.current,
        userId: "SYSTEM",
        content: "Bonjour ! Comment puis-je vous aider aujourd'hui ?",
        timestamp: new Date().toISOString(),
        type: "text",
        attachments: [],
        isUser: false
      };
      
      addMessage(welcomeMessage);
    }
  }, [isLoadingMessages, messages.length, addMessage]);

  // Fonction pour uploader des fichiers à Supabase et récupérer leurs URLs
  const createFileURLs = async (files: File[]): Promise<string[]> => {
    if (!files || files.length === 0) return [];
    
    setIsUploading(true);
    const uploadedUrls: string[] = [];
    
    try {
      appLogger.info('📤 Début de l\'upload de fichiers', { 
        count: files.length,
        types: files.map(f => f.type)
      });
      
      for (const file of files) {
        // Générer un nom unique pour le fichier
        const fileExt = file.name.split('.').pop();
        const fileName = `${uuidv4()}.${fileExt}`;
        const filePath = `public/${fileName}`;
        
        // Déterminer le type de fichier pour le dossier
        let fileFolder = 'images';
        if (file.type.startsWith('video/')) fileFolder = 'videos';
        else if (file.type.startsWith('audio/')) fileFolder = 'audio';
        else if (file.type === 'application/pdf') fileFolder = 'documents';
        else if (!file.type.startsWith('image/')) fileFolder = 'other';
        
        const finalPath = `${fileFolder}/${filePath}`;
        
        appLogger.info('📤 Uploading file', { 
          fileName, 
          fileType: file.type, 
          fileSize: file.size, 
          path: finalPath 
        });
        
        // Upload du fichier à Supabase storage
        const { error: uploadError, data } = await supabase.storage
          .from(fileFolder)
          .upload(filePath, file);
        
        if (uploadError) {
          appLogger.error('❌ Erreur lors de l\'upload d\'un fichier', { 
            error: uploadError, 
            fileName,
            fileType: file.type,
            path: finalPath 
          });
          toast({
            variant: "destructive",
            title: "Erreur d'upload",
            description: `Impossible d'uploader ${file.name}: ${uploadError.message}`
          });
          continue;
        }
        
        // Récupérer l'URL publique
        const { data: { publicUrl } } = supabase.storage
          .from(fileFolder)
          .getPublicUrl(filePath);
        
        appLogger.info('✅ Fichier uploadé avec succès', { 
          fileName, 
          publicUrl 
        });
        
        uploadedUrls.push(publicUrl);
      }
      
      appLogger.info('✅ Tous les fichiers ont été uploadés', { 
        totalUploaded: uploadedUrls.length, 
        urls: uploadedUrls 
      });
      
      return uploadedUrls;
    } catch (error) {
      appLogger.error('❌ Exception lors de l\'upload des fichiers', { error });
      toast({
        variant: "destructive",
        title: "Erreur d'upload",
        description: "Une erreur inattendue s'est produite pendant l'upload des fichiers."
      });
      return [];
    } finally {
      setIsUploading(false);
    }
  };

  const handleSendMessage = async (content: string, attachments: File[] = [], template?: { templateType: TemplateType, data: TemplateData }, promptGuidelines?: PromptGuidelines) => {
    // Générer un ID unique pour le message en utilisant crypto.randomUUID()
    const messageId = crypto.randomUUID();
    
    // Bloquer l'envoi si un upload est en cours
    if (isUploading) {
      toast({
        title: "Upload en cours",
        description: "Veuillez attendre que l'upload des fichiers soit terminé."
      });
      return;
    }
    
    // Déterminer le type de message pour l'UI
    let messageType: MessageType = "text";
    if (attachments.length > 0) {
      const firstAttachment = attachments[0];
      if (firstAttachment.type.startsWith("image/")) {
        messageType = "image";
      } else if (firstAttachment.type.startsWith("audio/")) {
        messageType = "audio";
      } else if (firstAttachment.type.startsWith("video/")) {
        messageType = "video";
      } else {
        messageType = "document";
      }
    }

    
    // Création de message personnalisé pour les templates
    let messageContent = content;
    
    // Si on a un template actif, convertir en QuoteCard si nécessaire
    const finalTemplate = template || activeTemplate;
    
    // Si c'est un template et qu'on n'a pas de contenu spécial en type quote card
    if (finalTemplate && !content.startsWith("__QUOTE_CARD__")) {
      console.log("Creating template message with full template data:", finalTemplate);
      
      // Message additionnell à ajouter avec le template
      if (content && content.trim() !== "") {
        // Utiliser la fonction utilitaire pour générer les données de quote
        const quoteData = buildQuoteData(
          finalTemplate.templateType,
          finalTemplate.data
        );
        
        // Ajouter le texte additionnel
        quoteData.additionalText = content.trim();
        
        // Formatter en JSON pour le message
        messageContent = `__QUOTE_CARD__${JSON.stringify(quoteData)}`;
      }
    }
    
    // 1. Déterminer idKey et idValue comme dans saveTemplateAndSync
let idKey = "", idValue = "";
if (finalTemplate) {
  switch (finalTemplate.templateType) {
    case "facture":
      idKey = "factureNumero";
      idValue = (finalTemplate.data as FactureData).factureNumero;
      break;
    case "devis":
      idKey = "devisNumero";
      idValue = (finalTemplate.data as DevisData).devisNumero;
      break;
    case "commande":
      idKey = "commandeNumero";
      idValue = (finalTemplate.data as CommandeData).commandeNumero;
      break;
    case "cahier_des_charges":
      idKey = "titre";
      idValue = (finalTemplate.data as CahierDesChargesData).titre;
      break;
  }
}

// 2. Récupérer la dernière version
const lastVersion = finalTemplate
  ? await getLastTemplateVersion(finalTemplate.templateType, idKey, idValue)
  : null;


        // Créer des promptGuidelines par défaut si non fournis
    const finalPromptGuidelines: PromptGuidelines = promptGuidelines || {
      title: "Guide pour les requêtes",
      description: `La dernière version du ${finalTemplate?.templateType} « ${idValue} » est ${lastVersion}`,
      examples: ["Exemple 1", "Exemple 2"]
    };

    setIsLoading(true);
    
    try {
      // Uploader les fichiers à Supabase et récupérer leurs URLs permanentes
      const attachmentUrls = await createFileURLs(attachments);
      
      // Créer un objet message pour l'UI
      const newMessage: Message = {
        id: messageId,
        sessionId: sessionId.current,
        userId: user.id,
        content: messageContent,
        timestamp: new Date().toISOString(),
        type: messageType,
        attachments: attachmentUrls, // Utiliser les URLs des fichiers uploadés
        isUser: true,
        promptGuidelines: finalPromptGuidelines,
        template: finalTemplate // Ajouter le template s'il existe
      };
      
      // Ajouter le message à la base de données via le hook (qui met aussi à jour l'état local)
      await addMessage(newMessage);
      
      // Déterminer le type de payload selon la nouvelle classification
      const hasText = content.trim() !== "";
      const hasAttachments = attachmentUrls.length > 0;
      const hasTemplate = finalTemplate !== null && finalTemplate !== undefined;
      
      const payloadType = determineMessagePayloadType(hasText, hasAttachments, hasTemplate);
      
      // Préparer le payload pour l'IA
      const payload: MessagePayload = {
        userId: user.id,
        sessionId: sessionId.current,
        timestamp: new Date().toISOString(),
        message: {
          type: payloadType as MessagePayloadType,
          content: content,
          attachments: attachmentUrls, // Ajouter les URLs permanentes des pièces jointes
          promptGuidelines: finalPromptGuidelines
        }
      };
      
      // Ajouter le template si présent (utiliser le template complet avec toutes ses données)
      if (hasTemplate && finalTemplate) {
        console.log("Adding template to payload:", finalTemplate);
        payload.message.template = {
          templateType: finalTemplate.templateType,
          data: finalTemplate.data
        };
        
        // Utiliser buildQuoteData pour générer la quote contextuelle
        payload.message.quote = buildQuoteData(
          finalTemplate.templateType,
          finalTemplate.data
        );
      }
      
      // Envoyer le message à l'IA avec l'agent sélectionné
      const response = await orchestrateRequest(payload, activeAgent);
      
      // Créer un message de réponse avec un UUID v4 réel
      const responseMessageId = crypto.randomUUID();
      
      // Utiliser le mode et le contenu appropriés selon le type de réponse
      const responseContent = response.response.mode === 'text' 
        ? response.response.textFallback
        : response.response.textFallback;
      
      const responseMessage: Message = {
        id: responseMessageId,
        sessionId: sessionId.current,
        userId: response.agentId,
        content: responseContent,
        timestamp: response.timestamp,
        type: "text",
        attachments: [],
        isUser: false
      };
      
      // Ajouter le template à la réponse si présent
      if (response.response.mode === 'template' && 
          'templateType' in response.response && 
          'data' in response.response) {
        responseMessage.template = {
          templateType: response.response.templateType!,
          data: response.response.data!,
          // Transférer aussi les métadonnées si présentes
          metadata: 'metadata' in response.response ? response.response.metadata : undefined
        };
      }
      
      // Ajouter la réponse à la base de données via le hook
      await addMessage(responseMessage);
      
      // Stocker le payload de réponse pour le message
      // Cette étape sera maintenant gérée par useMessages, mais nous pouvons aussi l'ajouter ici
      // pour une transition en douceur
      if (response.response.mode === 'template') {
        updatePayload(responseMessageId, response);
      }
      
      // Réinitialiser le template actif après envoi
      setActiveTemplate(null);
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Une erreur s'est produite lors de l'envoi du message."
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveTemplate = (data: any) => {
    toast({
      title: "Template enregistré",
      description: "Les modifications ont été enregistrées avec succès."
    });
    // Dans une application réelle, vous voudriez envoyer ces données à un serveur pour les sauvegarder
    console.log("Template data saved:", data);
  };

  const handleSelectTemplate = (templateType: TemplateType) => {
    // Au lieu d'envoyer directement, définir le template actif
    const defaultData = getDefaultTemplateData(templateType);
    
    // Ouvrir le template en mode édition
    setCurrentTemplateData({
      templateType,
      data: defaultData,
      metadata: {
        displayName: templateType.charAt(0).toUpperCase() + templateType.slice(1),
        availableActions: ['save', 'download'],
        mode: 'editable'
      }
    });
    setShowTemplateModal(true);
    setShowTemplateSelector(false);
  };
  
  const getDefaultTemplateData = (templateType: TemplateType): TemplateData => {
    switch (templateType) {
      case "facture":
        return {
          factureNumero: `F-${Date.now().toString().slice(-6)}`,
          dateEmission: new Date().toISOString().split('T')[0],
          client: {
            nom: "Client",
            adresse: "Adresse du client"
          },
          details: [
            { id: crypto.randomUUID(), description: "Produit ou service", quantite: 1, prixUnitaire: 0, sous_total: 0 }
          ],
          total: 0,
          version: 1,
          is_latest: true
        };
      case "devis":
        return {
          devisNumero: `D-${Date.now().toString().slice(-6)}`,
          dateEmission: new Date().toISOString().split('T')[0],
          validiteJours: 30,
          client: {
            nom: "Client",
            adresse: "Adresse du client"
          },
          details: [
            { id: crypto.randomUUID(), description: "Produit ou service", quantite: 1, prixUnitaire: 0, sous_total: 0 }
          ],
          total: 0,
          version: 1,
          is_latest: true
        };
      case "commande":
        return {
          commandeNumero: `CMD-${Date.now().toString().slice(-6)}`,
          dateCommande: new Date().toISOString().split('T')[0],
          dateEmission: new Date().toISOString().split('T')[0],
          client: {
            nom: "Client",
            adresse: "Adresse du client"
          },
          items: [
            { id: crypto.randomUUID(), nom: "Produit ou service", quantite: 1, prixUnitaire: 0, sous_total: 0 }
          ],
          details: [],
          total: 0,
          statut: "en_attente",
          version: 1,
          is_latest: true
        };
      case "cahier_des_charges":
        return {
          titre: `Projet-${Date.now().toString().slice(-6)}`,
          commande_id: "",
          materiaux: [
            { 
              id: crypto.randomUUID(), 
              nom: "Matériau", 
              quantite: 1, 
              unite: "pièce",
              largeur: 0,
              hauteur: 0
            }
          ],
          dimensions: {
            largeur: 0,
            hauteur: 0,
            profondeur: 0
          },
          technique: {
            type_structure: "Standard",
            method_fabrication: "Traditionnelle"
          },
          equipe: [
            { id: crypto.randomUUID(), nom: "Responsable projet", role: "Chef de projet" }
          ],
          version: 1,
          is_latest: true
        };
      // Autres cas par défaut
      default:
        return {} as TemplateData;
    }
  };

  // Vérifier si l'utilisateur a envoyé au moins un message
  const hasUserSentAnyMessage = () => {
    return messages.some(message => message.isUser);
  };
  
  const handleAskAI = () => {
    console.log("ChatContainer: handleAskAI appelé avec data", currentTemplateData?.data);
    if (currentTemplateData) {
      // Fermer la modal
      setShowTemplateModal(false);
      
      // Ajouter le template comme template actif pour l'envoyer avec le prochain message
      setActiveTemplate({
        templateType: currentTemplateData.templateType,
        data: currentTemplateData.data
      });
      
      console.log("Template actif défini:", {
        templateType: currentTemplateData.templateType,
        data: currentTemplateData.data
      });
    }
  };

const handleGeneratePDF = async (templateType: TemplateType, data: TemplateData) => {
  // Fermer la modal
  setShowTemplateModal(false);
  
  // Créer un ID unique pour l'action PDF
  const actionId = `pdf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Ajouter l'action en état ready (au lieu de pending) avec templateData et userId
  const newAction: PDFAction = {
    id: actionId,
    templateType,
    status: 'ready', // Changé de 'pending' à 'ready' pour éviter l'appel webhook automatique
    timestamp: new Date().toISOString(),
    sessionId: sessionId.current,
    templateData: data, // Ajouter les données du template
    userId: user.id, // Ajouter l'ID utilisateur
    documentNumber: getDocumentNumber(templateType, data) // Extraire le numéro du document
  };
  
  setPdfActions(prev => [...prev, newAction]);
};

// Fonction utilitaire pour extraire le numéro de document selon le type de template
const getDocumentNumber = (templateType: TemplateType, data: TemplateData): string | undefined => {
  switch (templateType) {
    case "facture":
      return (data as FactureData).factureNumero;
    case "devis":
      return (data as DevisData).devisNumero;
    case "commande":
      return (data as CommandeData).commandeNumero;
    default:
      return undefined;
  }
};

  const handleSetActiveTemplate = (templateType: TemplateType, data: TemplateData) => {
    console.log("Setting active template:", { templateType, data });
    // S'assurer que nous avons les données complètes du template avec le bon type
    setActiveTemplate({
      templateType,
      data
    });
  };
  
  const handleRemovePdfAction = (actionId: string) => {
    setPdfActions(prev => prev.filter(action => action.id !== actionId));
  };

  // Fonction to scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, []);

  // Handle scroll events to show/hide scroll button
  const handleScroll = useCallback(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
        // Show button when not at the bottom (with a small tolerance)
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
        setShowScrollButton(!isNearBottom);
      }
    }
  }, []);

  // Add scroll event listener
  useEffect(() => {
    const scrollContainer = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
      return () => {
        scrollContainer.removeEventListener('scroll', handleScroll);
      };
    }
  }, [handleScroll]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      // Add a small delay to ensure content is rendered
      const timeoutId = setTimeout(() => {
        scrollToBottom();
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [messages, scrollToBottom]);

  // Original useEffect for scrolling - modified to ensure smooth scrolling for new messages
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        // Use smooth scrolling
        scrollContainer.scrollTo({
          top: scrollContainer.scrollHeight,
          behavior: 'smooth'
        });
      }
    }
  }, [messages, pdfActions]);

  // Gérer l'adaptation mobile pour le template selector
  const templateSelectorClassName = isMobile 
    ? "fixed inset-0 z-50 bg-white animate-fadeIn overflow-auto" 
    : "w-72 border-l overflow-hidden animate-fade-in";

  const closeButton = isMobile && (
    <Button 
      variant="ghost" 
      size="sm" 
      onClick={() => setShowTemplateSelector(false)}
      className="absolute top-2 right-2 z-10"
    >
      <X className="h-5 w-5" />
    </Button>
  );

  return (
    <div className="flex flex-col h-full relative">
      
      {/* Zone de chat */}
      <div className="flex flex-1 overflow-hidden relative">
        <div className="flex-1 flex flex-col">
          <ScrollArea
            className="flex-1 px-1 py-2 md:px-4 md:py-4 w-full bg-gradient-to-b from-white to-gray-100 pb-[0px]"
            ref={scrollAreaRef}
          >
            <div className="space-y-3 md:space-y-4 w-full">
              {isLoadingMessages && (
                <div className="flex justify-center p-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                </div>
              )}
              
              {messages.map((message) => (
                <ChatMessage 
                  key={message.id} 
                  message={message} 
                  responsePayload={payloads[message.id]}
                  onSaveTemplate={handleSaveTemplate}
                  onGeneratePDF={handleGeneratePDF}
                  onSendMessage={handleSendMessage}
                  onSetActiveTemplate={handleSetActiveTemplate}
                  setMessages={setMessages}
                />
              ))}
              
              {/* Afficher les actions PDF */}
              {pdfActions.map((action) => (
                <PDFActionMessage 
                  key={action.id} 
                  action={action}
                  onRemove={handleRemovePdfAction} 
                />
              ))}
              
              {/* Remplacer l'indicateur de chargement par notre nouveau composant animé */}
              {isLoading && <LoadingMessage />}

              {/* SENTINEL : espaceur dynamique pour laisser assez d'espace pour les nouveaux messages */}
              <div className="h-[calc(env(safe-area-inset-bottom)+22rem)]" />
            </div>
          </ScrollArea>
          
          <MessageInput 
            onSendMessage={handleSendMessage} 
            hasUserSentMessage={hasUserSentAnyMessage()}
            activeTemplate={activeTemplate}
            onCancelTemplate={() => setActiveTemplate(null)}
            isLoading={isLoading || isUploading}
            activeAgent={activeAgent}
            onAgentChange={setActiveAgent}
          />
        </div>
        
        {/* Template selector - now hidden by default since we removed the button */}
        {showTemplateSelector && (
          <div className={templateSelectorClassName}>
            {closeButton}
            <TemplateSelector onSelect={handleSelectTemplate} />
          </div>
        )}
        
        {/* Modal pour éditer le template */}
        {showTemplateModal && currentTemplateData && (
          <TemplateModal
            isOpen={showTemplateModal}
            onClose={() => setShowTemplateModal(false)}
            templateType={currentTemplateData.templateType}
            data={currentTemplateData.data}
            metadata={currentTemplateData.metadata}
            setMessages={setMessages}
            onSave={handleSaveTemplate}
            onGeneratePDF={handleGeneratePDF}
            onAskAI={handleAskAI}
          />
        )}

        {/* Scroll to bottom button */}
        <ScrollToBottomButton 
          visible={showScrollButton} 
          onClick={scrollToBottom} 
        />
      </div>
    </div>
  );
};

export default ChatContainer;
