
import { useState, useEffect, useCallback } from 'react';
import { Message, ResponsePayload } from '@/types';
import { loadMessagesBySession, saveMessage } from '@/services/database';
import { supabase } from '@/integrations/supabase/client';
import { dbMessageToUiMessage } from '@/utils/conversion';
import { DBMessage } from '@/types/database';
import { buildLocalPayload } from "@/utils/response-payload";
import { appLogger } from '@/utils/logger';

interface UseMessagesProps {
  sessionId: string;
}

/**
 * Hook pour charger et gérer les messages d'une session
 * Standardisé pour utiliser exclusivement le format avec wrapper 'data'
 */
export function useMessages({ sessionId }: UseMessagesProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [payloads, setPayloads] = useState<Record<string, ResponsePayload>>({});

  // Charger les messages initiaux
  useEffect(() => {
    const loadMessages = async () => {
      try {
        setIsLoading(true);
        const data = await loadMessagesBySession(sessionId);
        
        // Vérifier la validité des URLs d'images et assurer qu'elles sont accessibles
        const validatedMessages = await Promise.all(data.map(async (message) => {
          if (message.attachments && message.attachments.length > 0) {
            // Vérifier les attachements pour s'assurer qu'ils sont valides
            const validAttachments = await Promise.all(message.attachments.map(async (url) => {
              // Vérifie si l'URL provient du stockage Supabase
              if (url.includes('storage/v1/object/public/images')) {
                try {
                  // Vérifier si l'URL est accessible
                  const { data: publicUrl } = supabase.storage
                    .from('images')
                    .getPublicUrl(url.split('/public/images/')[1]);
                  
                  return publicUrl.publicUrl;
                } catch (err) {
                  appLogger.error('Erreur lors de la validation de l\'URL:', err);
                  return url; // Retourner l'URL d'origine en cas d'erreur
                }
              }
              return url; // Retourner l'URL d'origine si ce n'est pas une URL Supabase
            }));
            
            return { ...message, attachments: validAttachments };
          }
          return message;
        }));

        setMessages(validatedMessages);
      } catch (err) {
        setError(err as Error);
        console.error("Erreur lors du chargement des messages:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadMessages();
  }, [sessionId]);

  // Configurer Realtime pour les mises à jour des messages
  useEffect(() => {
    const channel = supabase
      .channel('messages-changes')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'messages' }, 
        (payload) => {
          appLogger.info("🔔 Nouveau message détecté via Realtime:", payload);
          
          // Vérifier que payload.new contient les bonnes données
          if (!payload.new || typeof payload.new !== 'object') {
            appLogger.error("❌ Structure de payload incorrecte:", payload);
            return;
          }
          
          try {
            // Conversion en type DBMessage correct pour le passage à dbMessageToUiMessage
            const dbMessage = payload.new as DBMessage;
            const newMessage = dbMessageToUiMessage(dbMessage);
            
            // Vérifier si le message appartient à la session actuelle
            if (newMessage.sessionId === sessionId) {
              setMessages(prev => {
                // Vérifier si le message existe déjà (pour éviter les doublons)
                if (!prev.some(m => m.id === newMessage.id)) {
                  return [...prev, newMessage];
                }
                return prev;
              });
            }
          } catch (err) {
            appLogger.error("❌ Erreur lors du traitement du message Realtime:", err);
          }
        }
      )
      .on("postgres_changes",
          { event: "UPDATE", schema: "public", table: "messages" },
          (payload) => {
            appLogger.info("🔄 Message mis à jour via Realtime:", payload);

            if (!payload.new || typeof payload.new !== "object") {
              appLogger.error("❌ Structure de payload incorrecte:", payload);
              return;
            }

            try {
              const dbMessage = payload.new as DBMessage;
              const updatedMessage = dbMessageToUiMessage(dbMessage);

              if (updatedMessage.sessionId === sessionId) {
                // Log detailed versioning info for debugging
                if (updatedMessage.template) {
                  appLogger.info("🔖 Template version info from update:", {
                    id: updatedMessage.id,
                    templateType: updatedMessage.template.templateType,
                    version: updatedMessage.template.data?.version,
                    is_latest: updatedMessage.template.data?.is_latest
                  });
                }
                
                // 1️⃣ remplacement du message dans le state
                setMessages((prev) => {
                  const updated = prev.map((m) => (m.id === updatedMessage.id ? updatedMessage : m));
                  appLogger.info("🔄 Messages updated in state", { 
                    totalMessages: updated.length,
                    updated: updatedMessage.id
                  });
                  return updated;
                });

                // 2️⃣ 🔸 Mise à jour du responsePayload pour rafraîchir la preview
                if (updatedMessage.template) {
                  const newPayload = buildLocalPayload(updatedMessage);
                  if (newPayload) {
                    setPayloads((prev) => ({
                      ...prev,
                      [updatedMessage.id]: newPayload,
                    }));
                  }
                }
              }
            } catch (err) {
              appLogger.error(
                "❌ Erreur lors de la mise à jour du message Realtime:",
                err
              );
            }
          }
      )
      .subscribe();

    // Nettoyage lors du démontage
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  // Fonction pour ajouter un message
  const addMessage = useCallback(async (message: Message) => {
    try {
      // Ajouter à l'état local pour mise à jour immédiate de l'UI
      setMessages(prev => [...prev, message]);
      
      // Sauvegarder dans la base de données
      await saveMessage(message);
      
      return message;
    } catch (err) {
      console.error("Erreur lors de l'ajout du message:", err);
      throw err;
    }
  }, []);

  // Fonction pour mettre à jour les payloads de réponses
  const updatePayload = useCallback((messageId: string, payload: ResponsePayload) => {
    setPayloads(prev => ({
      ...prev,
      [messageId]: payload
    }));
  }, []);

  return { 
    messages, 
    setMessages,
    isLoading, 
    error, 
    addMessage,
    payloads,
    updatePayload
  };
}

export default useMessages;
