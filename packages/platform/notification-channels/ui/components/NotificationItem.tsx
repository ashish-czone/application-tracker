import { formatDistanceToNow } from 'date-fns';
import { cn } from '@packages/ui';
import type { Notification } from '../types';

interface NotificationItemProps {
  notification: Notification;
  onClick: (notification: Notification) => void;
}

export function NotificationItem({ notification, onClick }: NotificationItemProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(notification)}
      className={cn(
        'w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors border-b border-border last:border-b-0',
        !notification.isRead && 'bg-primary/5',
      )}
    >
      <div className="flex items-start gap-2.5">
        {/* Unread dot */}
        <div className="mt-1.5 shrink-0">
          {!notification.isRead ? (
            <span className="block w-2 h-2 rounded-full bg-primary" />
          ) : (
            <span className="block w-2 h-2" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn('text-sm', !notification.isRead ? 'font-medium text-foreground' : 'text-muted-foreground')}>
            {notification.title}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {notification.body}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
          </p>
        </div>
      </div>
    </button>
  );
}
