
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { TemplateModal } from '@/components/templates';
import { TemplateType } from '@/types';
import { UpdateItem } from './UpdateItem';
import { Json } from '@/types/project';

interface RecentUpdate {
  id: string;
  timestamp: string;
  user_id: string;
  session_id: string;
  userName?: string;
  templateType?: string;
  documentNumber?: string;
  content: string;
  isTemplate: boolean;
  isQuoteCard: boolean;
  isStatusChange?: boolean;
  oldStatus?: string;
  newStatus?: string;
  templateData?: any;
  updateType: 'message' | 'notification';
}

interface TemplateModalState {
  isOpen: boolean;
  templateType: TemplateType | null;
  data: any | null;
  messageId: string | null;
}

// Helper function to safely access nested data in template_data
const getNestedData = (templateData: Json | undefined): Record<string, any> | null => {
  if (!templateData) return null;
  
  if (typeof templateData === 'object' && templateData !== null && !Array.isArray(templateData)) {
    // Check if there's a nested data object
    if (templateData.data && typeof templateData.data === 'object' && !Array.isArray(templateData.data)) {
      return templateData.data as Record<string, any>;
    }
    // If no nested data object, return the object itself
    return templateData as Record<string, any>;
  }
  
  return null;
};

const RecentUpdates: React.FC = () => {
  const isMobile = useIsMobile();
  const [templateModal, setTemplateModal] = useState<TemplateModalState>({
    isOpen: false,
    templateType: null,
    data: null,
    messageId: null
  });
  
  // Fetch both recent messages and notifications
  const { data: messagesData, isLoading: isMessagesLoading } = useQuery({
    queryKey: ['recentMessages'],
    queryFn: async () => {
      try {
        // Fetch recent messages - now also fetch session_id
        const { data: messages, error } = await supabase
          .from('messages')
          .select('id, timestamp, user_id, session_id, content, template_type, template_data, sender')
          .order('timestamp', { ascending: false })
          .limit(12);

        if (error) throw error;
        return messages || [];
      } catch (error) {
        console.error('Error fetching recent messages:', error);
        return [];
      }
    }
  });

  const { data: notificationsData, isLoading: isNotificationsLoading } = useQuery({
    queryKey: ['recentNotifications'],
    queryFn: async () => {
      try {
        const { data: notifications, error } = await supabase
          .from('notifications')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(12);

        if (error) throw error;
        return notifications || [];
      } catch (error) {
        console.error('Error fetching notifications:', error);
        return [];
      }
    }
  });

  const { data: users } = useQuery({
    queryKey: ['appUsers'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('app_users')
          .select('session_id, name');

        if (error) throw error;
        return data || [];
      } catch (error) {
        console.error('Error fetching app users:', error);
        return [];
      }
    }
  });

  // Process and combine both messages and notifications data
  const updates = React.useMemo(() => {
    // Create a map of session_id to user names
    const userMap = new Map();
    if (users) {
      users.forEach(user => {
        if (user.session_id && user.name) {
          userMap.set(user.session_id, user.name);
        }
      });
    }

    // Transform messages into updates
    const messageUpdates: RecentUpdate[] = (messagesData || []).map(message => {
      let documentNumber = '';
      let isTemplate = false;
      let templateData = null;
      // Check if this is a quote card message
      const isQuoteCard = message.content && message.content.startsWith('__QUOTE_CARD__');
      
      // Extract quote card data if it's a quote card message
      if (isQuoteCard && message.content) {
        try {
          const jsonString = message.content.replace("__QUOTE_CARD__", "");
          const quoteData = JSON.parse(jsonString);
          documentNumber = quoteData.numero || quoteData.templateId || '';
          
          // For quote cards, we still set templateType if available
          if (quoteData.templateType) {
            message.template_type = quoteData.templateType;
          }
        } catch (e) {
          console.error("Error parsing quote card data:", e);
        }
      } 
      // Otherwise process as normal template message
      else if (message.template_type && message.template_data) {
        isTemplate = true;
        templateData = message.template_data;
        
        // Safely access nested data object
        let documentIdentifier = '';
        const nestedData = getNestedData(message.template_data);
        
        if (nestedData) {
          if (message.template_type === 'facture') {
            documentIdentifier = nestedData.factureNumero || '';
          } else if (message.template_type === 'devis') {
            documentIdentifier = nestedData.devisNumero || '';
          } else if (message.template_type === 'commande') {
            documentIdentifier = nestedData.commandeNumero || '';
          } else if (message.template_type === 'cahier_des_charges') {
            documentIdentifier = nestedData.titre || '';
          }
        }
        
        documentNumber = documentIdentifier;
      }

      // First try to get username from session_id map
      // If not found, fall back to previous methods
      const userName = userMap.get(message.session_id) || 
                      (message.sender && message.sender.split(':')[0]) || 
                      'Utilisateur';

      return {
        id: message.id,
        timestamp: message.timestamp,
        user_id: message.user_id,
        session_id: message.session_id,
        userName: userName,
        templateType: message.template_type,
        documentNumber,
        content: message.content || '',
        isTemplate,
        isQuoteCard,
        templateData: message.template_data,
        updateType: 'message'
      };
    });

    // Transform notifications into updates
    const notificationUpdates: RecentUpdate[] = (notificationsData || []).map(notification => {
      const userName = userMap.get(notification.session_id) || 'Utilisateur';
      
      return {
        id: notification.id,
        timestamp: notification.timestamp,
        user_id: notification.user_id,
        session_id: notification.session_id,
        userName: userName,
        templateType: notification.template_type as string,
        documentNumber: notification.document_number || '',
        content: '',
        isTemplate: false,
        isQuoteCard: false,
        isStatusChange: notification.event_type === 'status_changed',
        oldStatus: notification.old_status,
        newStatus: notification.new_status,
        templateData: null,
        updateType: 'notification'
      };
    });

    // Combine and sort all updates by timestamp
    return [...messageUpdates, ...notificationUpdates]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 12); // Limit to 12 total items

  }, [messagesData, notificationsData, users]);

  // Helper function to format relative time
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.round(diffMs / 1000);
    const diffMins = Math.round(diffSecs / 60);
    const diffHours = Math.round(diffMins / 60);
    const diffDays = Math.round(diffHours / 24);

    if (diffSecs < 60) return `Il y a ${diffSecs} secondes`;
    if (diffMins < 60) return `Il y a ${diffMins} minutes`;
    if (diffHours < 24) return `Il y a ${diffHours} heures`;
    if (diffDays < 7) return `Il y a ${diffDays} jours`;
    
    return date.toLocaleDateString('fr-FR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  };

  // Helper function to get template type display name
  const getTemplateTypeName = (type?: string) => {
    if (!type) return '';
    const names: Record<string, string> = {
      facture: 'Facture',
      devis: 'Devis',
      commande: 'Commande',
      cahier_des_charges: 'Cahier des charges'
    };
    return names[type] || type;
  };

  // Function to fetch template data for a document id
  const fetchTemplateData = async (templateType: string, documentNumber: string) => {
    try {
      const key = templateType === 'facture' ? 'factureNumero' :
                 templateType === 'devis' ? 'devisNumero' :
                 templateType === 'commande' ? 'commandeNumero' :
                 templateType === 'cahier_des_charges' ? 'titre' : null;
      
      if (!key) return null;

      const { data: messages, error } = await supabase
        .from('messages')
        .select('id, template_data')
        .eq('template_type', templateType)
        .filter(`template_data->data->>${key}`, 'eq', documentNumber)
        .order('timestamp', { ascending: false })
        .limit(1);

      if (error) throw error;
      
      if (messages && messages.length > 0) {
        const templateData = messages[0].template_data;
        // Safely access data property
        const nestedData = getNestedData(templateData);
        
        return {
          messageId: messages[0].id,
          data: nestedData
        };
      }
      return null;
    } catch (error) {
      console.error('Error fetching template data:', error);
      return null;
    }
  };

  // Function to handle clicking on a document ID
  const handleDocumentClick = async (update: RecentUpdate) => {
    // If this is from a message with template data already available
    if (update.updateType === 'message' && update.templateType && update.templateData) {
      // Safely extract data property if it exists
      const nestedData = getNestedData(update.templateData);
      
      setTemplateModal({
        isOpen: true,
        templateType: update.templateType as TemplateType,
        data: nestedData,
        messageId: update.id
      });
      return;
    }
    
    // If this is a notification or quote card, we need to fetch the template data
    if (update.templateType && update.documentNumber) {
      const result = await fetchTemplateData(update.templateType, update.documentNumber);
      if (result) {
        setTemplateModal({
          isOpen: true,
          templateType: update.templateType as TemplateType,
          data: result.data,
          messageId: result.messageId
        });
      }
    }
  };

  // Function to close the modal
  const handleCloseModal = () => {
    setTemplateModal({
      isOpen: false,
      templateType: null,
      data: null,
      messageId: null
    });
  };

  const isLoading = isMessagesLoading || isNotificationsLoading;

  return (
    <Card className="w-full shadow-md">
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Mises à jour récentes
        </CardTitle>
        <CardDescription>
          Activité récente des utilisateurs
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-start space-x-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {!updates || updates.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Aucune mise à jour récente
              </div>
            ) : (
              updates.map((update) => (
                <UpdateItem
                  key={update.id}
                  id={update.id}
                  userName={update.userName || 'Utilisateur'}
                  timestamp={update.timestamp}
                  templateType={update.templateType}
                  documentNumber={update.documentNumber}
                  content={update.content}
                  isTemplate={update.isTemplate}
                  isQuoteCard={update.isQuoteCard}
                  isStatusChange={update.isStatusChange}
                  oldStatus={update.oldStatus}
                  newStatus={update.newStatus}
                  isMobile={isMobile}
                  formattedTime={formatRelativeTime(update.timestamp)}
                  onDocumentClick={() => handleDocumentClick(update)}
                />
              ))
            )}
          </div>
        )}
      </CardContent>

      {/* Template Modal */}
      {templateModal.isOpen && templateModal.templateType && templateModal.data && (
        <TemplateModal
          isOpen={templateModal.isOpen}
          onClose={handleCloseModal}
          templateType={templateModal.templateType}
          data={templateModal.data}
          messageId={templateModal.messageId}
          metadata={{
            displayName: getTemplateTypeName(templateModal.templateType),
            description: "Document depuis les mises à jour récentes",
            mode: "readonly",
            source: "library",
            availableActions: []
          }}
        />
      )}
    </Card>
  );
};

export default RecentUpdates;
