import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeftCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ChatMessage from "@/components/chat/ChatMessage";
import { Message, ResponsePayload, TemplateType, TemplateMetadata, MessageType, ResponseMode } from "@/types";
import { motion } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { LoadingMessage } from "@/components/chat";

const Demo = () => {
  const navigate = useNavigate();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [demoMessages, setDemoMessages] = useState<Message[]>([]);
  const [responsePayloads, setResponsePayloads] = useState<Record<string, ResponsePayload>>({});
  const isMobile = useIsMobile();
  const { toast } = useToast();

  // Données de démonstration pour les templates
  const demoData = [
    {
      userMessage: {
        id: "user_msg_1",
        sessionId: "demo_session",
        userId: "demo_user",
        content: "Bonjour, j'aurais besoin d'une facture pour mon récent achat.",
        timestamp: new Date().toISOString(),
        type: "text" as MessageType,
        attachments: [],
        isUser: true
      },
      agentResponse: {
        id: "agent_resp_1",
        sessionId: "demo_session",
        userId: "agent_id",
        content: "Voici votre facture, vous pouvez la consulter et la modifier si nécessaire.",
        timestamp: new Date().toISOString(),
        type: "text" as MessageType,
        attachments: [],
        isUser: false
      },
      responsePayload: {
        agentId: "agent_id",
        sessionId: "demo_session",
        timestamp: new Date().toISOString(),
        response: {
          mode: "template" as ResponseMode,
          templateType: "facture" as TemplateType,
          textFallback: "Voici votre facture, vous pouvez la consulter et la modifier si nécessaire.",
          data: {
            factureNumero: "FACT-2025-001",
            dateEmission: "2025-04-10",
            client: {
              nom: "Jean Dupont",
              adresse: "123 Rue de la République, 75001 Paris"
            },
            details: [
              { description: "Consultation initiale", quantite: 1, prixUnitaire: 120 },
              { description: "Suivi de dossier", quantite: 2, prixUnitaire: 80 }
            ],
            total: 280
          },
          metadata: {
            displayName: "Facture Démonstration",
            description: "Exemple de facture interactif",
            availableActions: ["save", "download"],
            mode: "editable"
          }
        }
      }
    },
    {
      userMessage: {
        id: "user_msg_2",
        sessionId: "demo_session",
        userId: "demo_user",
        content: "Parfait ! Maintenant j'aimerais passer une commande pour un projet spécifique.",
        timestamp: new Date(Date.now() + 2000).toISOString(),
        type: "text" as MessageType,
        attachments: [],
        isUser: true
      },
      agentResponse: {
        id: "agent_resp_2",
        sessionId: "demo_session",
        userId: "agent_id",
        content: "Je crée votre commande. Vous pouvez la personnaliser selon vos besoins.",
        timestamp: new Date(Date.now() + 4000).toISOString(),
        type: "text" as MessageType,
        attachments: [],
        isUser: false
      },
      responsePayload: {
        agentId: "agent_id",
        sessionId: "demo_session",
        timestamp: new Date(Date.now() + 4000).toISOString(),
        response: {
          mode: "template" as ResponseMode,
          templateType: "commande" as TemplateType,
          textFallback: "Voici votre bon de commande, n'hésitez pas à l'ajuster selon vos besoins.",
          data: {
            commandeNumero: "CMD-2025-001",
            dateCommande: "2025-04-10",
            client: {
              nom: "Jean Dupont",
              adresse: "123 Rue de la République, 75001 Paris"
            },
            statut: "en_attente",
            items: [
              { 
                nom: "Bureau sur mesure", 
                quantite: 1, 
                prixUnitaire: 850,
                sous_total: 850,
                image_url: ""
              },
              { 
                nom: "Étagères murales", 
                quantite: 3, 
                prixUnitaire: 120,
                sous_total: 360,
                image_url: ""
              }
            ],
            total: 1210,
            linked_facture_id: "FACT-2025-001"
          },
          metadata: {
            displayName: "Commande Mobilier",
            description: "Commande de mobilier sur mesure",
            availableActions: ["save", "download"],
            mode: "editable"
          }
        }
      }
    },
    {
      userMessage: {
        id: "user_msg_3",
        sessionId: "demo_session",
        userId: "demo_user",
        content: "J'aimerais définir les spécifications techniques pour cette commande.",
        timestamp: new Date(Date.now() + 6000).toISOString(),
        type: "text" as MessageType,
        attachments: [],
        isUser: true
      },
      agentResponse: {
        id: "agent_resp_3",
        sessionId: "demo_session",
        userId: "agent_id",
        content: "Je prépare un cahier des charges détaillé pour votre commande.",
        timestamp: new Date(Date.now() + 8000).toISOString(),
        type: "text" as MessageType,
        attachments: [],
        isUser: false
      },
      responsePayload: {
        agentId: "agent_id",
        sessionId: "demo_session",
        timestamp: new Date(Date.now() + 8000).toISOString(),
        response: {
          mode: "template" as ResponseMode,
          templateType: "cahier_des_charges" as TemplateType,
          textFallback: "Voici le cahier des charges pour votre commande. Vous pouvez préciser tous les détails techniques.",
          data: {
            titre: "Cahier des charges - Mobilier sur mesure",
            commande_id: "CMD-2025-001",
            materiaux: [
              { id: "mat-1", nom: "Chêne massif", quantite: 5, unite: "m²", dimension: "20mm" },
              { id: "mat-2", nom: "Acier brossé", quantite: 2, unite: "m", dimension: "30x30mm" }
            ],
            dimensions: {
              largeur: 180,
              hauteur: 75,
              profondeur: 80
            },
            technique: {
              type_structure: "Assemblage traditionnel",
              method_fabrication: "Menuiserie traditionnelle"
            },
            equipe: [
              { id: "eq-1", nom: "Marie Lambert", role: "Menuisière" },
              { id: "eq-2", nom: "Pierre Durand", role: "Designer" }
            ]
          },
          metadata: {
            displayName: "Cahier des charges - Mobilier",
            description: "Spécifications techniques du projet",
            availableActions: ["save", "download", "add_field"],
            mode: "editable"
          }
        }
      }
    }
  ];

  // Ajouter un message de bienvenue au chargement
  useEffect(() => {
    const welcomeMessage: Message = {
      id: `welcome_demo`,
      sessionId: "demo_session",
      userId: "agent_id",
      content: "Bienvenue dans cette démonstration ! Vous allez voir comment les templates interactifs fonctionnent. Cette conversation est fictive et utilise des données d'exemple.",
      timestamp: new Date().toISOString(),
      type: "text" as MessageType,
      attachments: [],
      isUser: false
    };
    
    setDemoMessages([welcomeMessage]);
  }, []);

  // Ajouter progressivement les messages de démo
  useEffect(() => {
    if (currentStep < demoData.length) {
      const timer = setTimeout(() => {
        const { userMessage, agentResponse, responsePayload } = demoData[currentStep];
        
        // Ajouter le message utilisateur
        setDemoMessages(prev => [...prev, userMessage as Message]);
        
        // Ajouter la réponse de l'agent après un délai
        const agentTimer = setTimeout(() => {
          setDemoMessages(prev => [...prev, agentResponse as Message]);
          
          // Ajouter le payload de réponse pour afficher le template
          setResponsePayloads(prev => ({
            ...prev,
            [agentResponse.id]: responsePayload as ResponsePayload
          }));
          
          // Passer à l'étape suivante
          setCurrentStep(prev => prev + 1);
        }, 1500);
        
        return () => clearTimeout(agentTimer);
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [currentStep, demoData]);

  // Défiler vers le bas lorsque de nouveaux messages sont ajoutés
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [demoMessages]);

  const handleSaveTemplate = (data: any) => {
    toast({
      title: "Modification enregistrée",
      description: "Ceci est une démonstration. Les données ne sont pas réellement sauvegardées."
    });
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* En-tête */}
      <div className="flex justify-between items-center p-2 md:p-4 border-b">
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="mr-2"
          >
            <ArrowLeftCircle className="h-5 w-5 mr-1" />
            <span className="hidden md:inline">Retour</span>
          </Button>
          <span className="logo-text">Asso<span className="logo-highlight">AI</span> <span className="text-sm font-normal text-gray-500">(Démo)</span></span>
        </div>
      </div>
      
      {/* Zone de chat de démonstration */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <ScrollArea className="flex-1 p-2 md:p-4" ref={scrollAreaRef}>
          <div className="space-y-3 md:space-y-4">
            {demoMessages.map((message) => (
              <ChatMessage 
                key={message.id} 
                message={message} 
                responsePayload={responsePayloads[message.id]}
                onSaveTemplate={handleSaveTemplate}
              />
            ))}
            
            {currentStep < demoData.length && <LoadingMessage />}
          </div>
        </ScrollArea>
        
        {/* Zone de saisie de message factice */}
        <div className="p-2 md:p-4 border-t bg-white">
          <div className="relative">
            <input
              type="text"
              placeholder="Ceci est une démonstration, vous ne pouvez pas envoyer de messages"
              disabled
              className="message-input w-full opacity-70"
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-xs text-gray-500">Démonstration uniquement</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bannière de démonstration */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1, duration: 0.5 }}
        className="fixed bottom-0 left-0 right-0 bg-brand-orange text-white text-center py-2 text-sm"
      >
        Ceci est une démonstration. Les templates sont interactifs - cliquez dessus pour les explorer !
      </motion.div>
    </div>
  );
};

export default Demo;
