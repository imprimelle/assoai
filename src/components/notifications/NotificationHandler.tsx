
import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useToast } from '@/hooks/use-toast';

interface Notification {
  id: string;
  event_type: string;
  template_type: string;
  document_number?: string;
  old_status?: string;
  new_status?: string;
  timestamp: string;
  read: boolean;
}

const getNotificationMessage = (notification: Notification): string => {
  const templateTypeMap: Record<string, string> = {
    facture: 'Facture',
    devis: 'Devis',
    commande: 'Commande',
    cahier_des_charges: 'Cahier des charges'
  };

  const templateTypeName = templateTypeMap[notification.template_type] || notification.template_type;
  
  if (notification.event_type === 'template_created') {
    return `Nouveau ${templateTypeName.toLowerCase()} créé: ${notification.document_number || ''}`;
  } else if (notification.event_type === 'status_changed') {
    return `Statut ${templateTypeName.toLowerCase()} ${notification.document_number || ''} modifié: ${notification.old_status || ''} → ${notification.new_status || ''}`;
  }
  
  return `Nouvelle notification: ${notification.document_number || ''}`;
};

const NotificationHandler: React.FC = () => {
  const { toast: shadcnToast } = useToast();
  const [notificationSound] = useState(new Audio('/sounds/notification.mp3'));
  const [hasNotificationPermission, setHasNotificationPermission] = useState<boolean | null>(null);

  // Check notification permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      setHasNotificationPermission(Notification.permission === 'granted');
    }
  }, []);

  // Request notification permission when needed
  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      setHasNotificationPermission(permission === 'granted');
    }
  };

  // Mark notification as read
  const markNotificationAsRead = async (id: string) => {
    try {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Subscribe to real-time notifications
  useEffect(() => {
    requestNotificationPermission();
    
    // Subscribe to the notifications table
    const channel = supabase
      .channel('notifications-handler')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'notifications' 
        },
        async (payload) => {
          console.log('Nouvelle notification reçue:', payload);
          
          if (payload.new) {
            const notification = payload.new as Notification;
            
            if (notification && !notification.read) {
              const message = getNotificationMessage(notification);
              
              // Play notification sound
              try {
                notificationSound.currentTime = 0;
                await notificationSound.play();
              } catch (error) {
                console.error('Error playing notification sound:', error);
              }
              
              // Show toast notification with Sonner (more modern)
              toast(message, {
                description: `${new Date(notification.timestamp).toLocaleTimeString()}`,
                action: {
                  label: 'Marquer comme lu',
                  onClick: () => markNotificationAsRead(notification.id),
                },
              });
              
              // Also show browser notification if permission granted
              if (hasNotificationPermission) {
                const browserNotification = new Notification('Asso AI', {
                  body: message,
                  icon: '/icons/icon-192x192.png',
                });
                
                browserNotification.onclick = () => {
                  markNotificationAsRead(notification.id);
                  window.focus();
                };
              }
            }
          }
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [notificationSound, hasNotificationPermission]);

  return null; // This component doesn't render anything
};

export default NotificationHandler;
