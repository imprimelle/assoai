import React, { useState, useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { AppNotification } from '@/types/notification';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

const LEVEL_STYLES: Record<AppNotification['level'], string> = {
  critical: 'border-l-2 border-l-red-500 bg-red-50',
  warning: 'border-l-2 border-l-orange-400 bg-orange-50',
  info: 'border-l-2 border-l-blue-400',
};

const TYPE_ICONS: Record<AppNotification['type'], string> = {
  alerte: '🔴',
  rappel: '⏰',
  info: 'ℹ️',
  escalade: '🚨',
};

function getUserId(): string | undefined {
  try {
    const stored = localStorage.getItem('currentUser');
    if (stored) {
      const user = JSON.parse(stored);
      return user?.id;
    }
  } catch {}
  return undefined;
}

interface NotificationCenterProps {
  open: boolean;
  onClose: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ open, onClose }) => {
  const userId = getUserId();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications(userId);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [open, onClose]);

  if (!open) return null;

  const handleNotificationClick = (notif: AppNotification) => {
    if (!notif.read) {
      markAsRead.mutate(notif.id);
    }
    if (notif.link) {
      // Valider que le lien est une route interne valide
      const isValidLink = /^\/(projects|chat|products|agent-config|logs|library)/.test(notif.link);
      if (isValidLink) {
        navigate(notif.link);
        onClose();
      }
    }
  };

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-9 w-80 max-h-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
        <span className="font-semibold text-sm text-gray-800">
          Notifications
          {unreadCount > 0 && (
            <span className="ml-1.5 text-xs text-gray-500">
              ({unreadCount} non lue{unreadCount > 1 ? 's' : ''})
            </span>
          )}
        </span>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllAsRead.mutate()}
            className="text-xs text-brand-orange hover:underline"
          >
            Tout marquer lu
          </button>
        )}
      </div>

      {/* List */}
      <div className="overflow-y-auto flex-1">
        {!notifications || notifications.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-gray-400">
            Aucune notification
          </div>
        ) : (
          notifications.map((notif) => (
            <button
              key={notif.id}
              onClick={() => handleNotificationClick(notif)}
              className={cn(
                'w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50',
                !notif.read && 'bg-white',
                notif.read && 'opacity-70',
                LEVEL_STYLES[notif.level]
              )}
            >
              <div className="flex items-start gap-2">
                <span className="text-sm mt-0.5">{TYPE_ICONS[notif.type]}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {!notif.read && (
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-orange flex-shrink-0" />
                    )}
                    <span className="text-xs font-medium text-gray-800 truncate">
                      {notif.title}
                    </span>
                  </div>
                  {notif.message && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                      {notif.message}
                    </p>
                  )}
                  <span className="text-[10px] text-gray-400 mt-1 block">
                    {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: fr })}
                  </span>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
};

interface NotificationBellProps {
  className?: string;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ className }) => {
  const [open, setOpen] = useState(false);
  const userId = getUserId();
  const { unreadCount } = useNotifications(userId);

  return (
    <div className={cn('relative', className)}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'relative flex items-center justify-center w-8 h-8 rounded-md transition-colors',
          open ? 'bg-gray-100' : 'hover:bg-gray-100',
          unreadCount > 0 && 'text-brand-orange'
        )}
        title="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <NotificationCenter open={open} onClose={() => setOpen(false)} />
    </div>
  );
};
