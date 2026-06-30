import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppNotification } from '@/types/notification';
import { appLogger } from '@/utils/logger';

export const useNotifications = (userId?: string) => {
  const queryClient = useQueryClient();

  // Fetch all notifications for the user
  const { data: notifications, isLoading } = useQuery({
    queryKey: ['notifications', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from('app_notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw new Error(error.message);
      return (data || []) as AppNotification[];
    },
    enabled: !!userId,
    staleTime: 30_000, // 30s cache
  });

  // Realtime subscription — invalidate query on new notifications
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`app_notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'app_notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          appLogger.info('🔔 Nouvelle notification reçue', { id: (payload.new as any)?.id });
          queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'app_notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          appLogger.info('🔔 Souscription realtime notifications active');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  // Count unread
  const unreadCount = notifications?.filter(n => !n.read).length ?? 0;

  // Mark single notification as read
  const markAsRead = useMutation({
    mutationFn: async (notifId: string) => {
      const { error } = await supabase
        .from('app_notifications')
        .update({ read: true })
        .eq('id', notifId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
    },
  });

  // Mark all as read
  const markAllAsRead = useMutation({
    mutationFn: async () => {
      if (!userId) return;
      const { error } = await supabase
        .from('app_notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
    },
  });

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
  };
};
