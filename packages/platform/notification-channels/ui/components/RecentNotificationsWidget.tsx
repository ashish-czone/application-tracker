import { formatDistanceToNow } from 'date-fns';
import { Bell } from 'lucide-react';
import { cn, Skeleton } from '@packages/ui';
import { useNotifications } from '../hooks';

export function RecentNotificationsWidget() {
  const { data, isLoading, isError } = useNotifications({ page: 1, limit: 5 });
  const notifications = data?.data ?? [];

  if (isLoading) {
    return (
      <ul className="divide-y divide-rule">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i} className="flex items-start gap-3 px-5 py-3">
            <Skeleton className="mt-1.5 h-2 w-2 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </li>
        ))}
      </ul>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center px-5 py-10 text-center">
        <p className="text-sm text-ink-soft">Could not load notifications.</p>
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-5 py-10 text-center">
        <Bell className="w-6 h-6 text-ink-muted mb-2" strokeWidth={1.5} />
        <p className="font-serif italic text-ink-soft">You are all caught up.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-rule">
      {notifications.map((n) => (
        <li
          key={n.id}
          className={cn(
            'flex items-start gap-3 px-5 py-3',
            !n.isRead && 'bg-paper-subtle',
          )}
        >
          <span
            aria-hidden
            className={cn(
              'mt-1.5 block h-2 w-2 shrink-0 rounded-full',
              n.isRead ? 'bg-transparent' : 'bg-signal',
            )}
          />
          <div className="flex-1 min-w-0">
            <p
              className={cn(
                'text-sm leading-tight',
                n.isRead ? 'text-ink-soft' : 'font-medium text-ink',
              )}
            >
              {n.title}
            </p>
            {n.body ? (
              <p className="mt-0.5 text-xs text-ink-soft line-clamp-1">{n.body}</p>
            ) : null}
            <p className="mt-1 text-[10px] uppercase tracking-eyebrow text-ink-muted">
              {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
