import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  CheckCheck,
  FileText,
  Users,
  Monitor,
  UserPlus,
  Bell,
} from 'lucide-react';
import { DrawerShell, DrawerHeader, Eyebrow, SectionRule } from '@packages/ui';
import { MOCK_NOTIFICATIONS, type AppNotification } from './notificationsMock';

// ─── Category config ────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<
  AppNotification['category'],
  { icon: typeof Bell; bg: string; iconColor: string }
> = {
  filing: { icon: FileText, bg: 'bg-signal/8', iconColor: 'text-signal' },
  client: { icon: Users, bg: 'bg-authority/8', iconColor: 'text-authority' },
  system: { icon: Monitor, bg: 'bg-ink/5', iconColor: 'text-ink-muted' },
  assignment: { icon: UserPlus, bg: 'bg-due-soon/8', iconColor: 'text-due-soon' },
};

// ─── Props ──────────────────────────────────────────────────────────

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
}

// ─── Component ──────────────────────────────────────────────────────

export function NotificationPanel({ open, onClose }: NotificationPanelProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>(MOCK_NOTIFICATIONS);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  function markAsRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
  }

  function markAllAsRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }

  const groups = groupNotifications(notifications);

  return (
    <AnimatePresence>
      {open && (
        <DrawerShell onClose={onClose} width="md">
            <DrawerHeader
              titleSize="sm"
              eyebrow={<Eyebrow tone="muted" mark="◈">Notifications</Eyebrow>}
              title="Inbox"
              subtitle={
                unreadCount > 0 ? (
                  <span className="font-sans not-italic text-[11px] text-ink-muted">
                    <span className="font-mono tabular-nums font-medium text-ink">
                      {unreadCount}
                    </span>{' '}
                    unread
                  </span>
                ) : undefined
              }
              onClose={onClose}
              closeLabel="Close notifications"
            >
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="mt-3 flex items-center gap-1.5 text-[11px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted hover:text-ink transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" strokeWidth={1.5} />
                  Mark all as read
                </button>
              )}
            </DrawerHeader>

            {/* ── Notification list ────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="text-center py-16 px-6">
                  <div className="w-10 h-10 mx-auto mb-3 bg-paper-sunken border border-rule flex items-center justify-center">
                    <Bell className="w-5 h-5 text-ink-muted/40" strokeWidth={1} />
                  </div>
                  <p className="text-sm text-ink-muted font-sans">
                    No notifications yet
                  </p>
                  <p className="text-[11px] text-ink-muted/60 font-sans mt-1">
                    You'll see filing alerts, assignments, and updates here.
                  </p>
                </div>
              ) : (
                groups.map((group, gi) => (
                  <div key={group.label}>
                    {gi > 0 && (
                      <div className="px-6">
                        <SectionRule />
                      </div>
                    )}
                    <div className="px-6 pt-4 pb-2">
                      <span className="text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted">
                        {group.label}
                      </span>
                    </div>
                    {group.items.map((n) => (
                      <NotificationRow
                        key={n.id}
                        notification={n}
                        onMarkAsRead={markAsRead}
                      />
                    ))}
                  </div>
                ))
              )}
            </div>
        </DrawerShell>
      )}
    </AnimatePresence>
  );
}

// ─── Notification row ───────────────────────────────────────────────

function NotificationRow({
  notification,
  onMarkAsRead,
}: {
  notification: AppNotification;
  onMarkAsRead: (id: string) => void;
}) {
  const config = CATEGORY_CONFIG[notification.category];
  const Icon = config.icon;

  return (
    <button
      type="button"
      onClick={() => !notification.isRead && onMarkAsRead(notification.id)}
      className={`w-full text-left px-6 py-3.5 flex items-start gap-3 transition-colors group ${
        notification.isRead
          ? 'hover:bg-paper-sunken/40'
          : 'bg-signal/[0.03] hover:bg-signal/[0.06]'
      }`}
    >
      {/* Category icon */}
      <div
        className={`w-7 h-7 flex items-center justify-center flex-none mt-0.5 ${config.bg}`}
      >
        <Icon className={`w-3.5 h-3.5 ${config.iconColor}`} strokeWidth={1.5} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <p
            className={`text-sm leading-snug flex-1 ${
              notification.isRead
                ? 'font-sans text-ink-muted'
                : 'font-sans font-medium text-ink'
            }`}
          >
            {notification.title}
          </p>
          {/* Unread dot */}
          {!notification.isRead && (
            <span className="w-1.5 h-1.5 bg-signal flex-none mt-1.5" />
          )}
        </div>
        <p className="text-[12px] text-ink-muted font-sans mt-0.5 line-clamp-2 leading-relaxed">
          {notification.body}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          {notification.actor && (
            <span className="text-[10px] font-sans font-medium text-ink-muted">
              {notification.actor.name}
            </span>
          )}
          <span className="text-[10px] font-mono tabular-nums text-ink-muted/60">
            {formatRelativeTime(notification.timestamp)}
          </span>
        </div>
      </div>
    </button>
  );
}

// ─── Grouping ──────────────────────────────────────────────────────

interface NotificationGroup {
  label: string;
  items: AppNotification[];
}

/** Reference "now" for the static preview. */
const NOW = new Date('2026-04-17T12:00:00Z');

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function getMonday(d: Date): Date {
  const day = d.getDay(); // 0=Sun … 6=Sat
  const diff = day === 0 ? 6 : day - 1; // days since Monday
  const mon = new Date(d);
  mon.setDate(mon.getDate() - diff);
  return new Date(mon.getFullYear(), mon.getMonth(), mon.getDate());
}

function groupNotifications(items: AppNotification[]): NotificationGroup[] {
  const todayStart = startOfDay(NOW);
  const yesterdayStart = todayStart - 86_400_000;
  const weekStart = getMonday(NOW).getTime();
  const monthStart = new Date(NOW.getFullYear(), NOW.getMonth(), 1).getTime();

  const buckets: Record<string, AppNotification[]> = {
    today: [],
    yesterday: [],
    thisWeek: [],
    thisMonth: [],
    earlier: [],
  };

  for (const n of items) {
    const t = new Date(n.timestamp).getTime();
    if (t >= todayStart) buckets.today.push(n);
    else if (t >= yesterdayStart) buckets.yesterday.push(n);
    else if (t >= weekStart) buckets.thisWeek.push(n);
    else if (t >= monthStart) buckets.thisMonth.push(n);
    else buckets.earlier.push(n);
  }

  const labels: [string, string][] = [
    ['today', 'Today'],
    ['yesterday', 'Yesterday'],
    ['thisWeek', 'This week'],
    ['thisMonth', 'This month'],
    ['earlier', 'Earlier'],
  ];

  return labels
    .filter(([key]) => buckets[key].length > 0)
    .map(([key, label]) => ({ label, items: buckets[key] }));
}

// ─── Helpers ────────────────────────────────────────────────────────

function formatRelativeTime(iso: string): string {
  const then = new Date(iso);
  const diffMs = NOW.getTime() - then.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMs / 3_600_000);

  // Calendar-day difference (not raw 24h blocks)
  const nowDay = startOfDay(NOW);
  const thenDay = startOfDay(then);
  const diffDay = Math.round((nowDay - thenDay) / 86_400_000);

  if (diffDay === 0 && diffMin < 60) return `${diffMin}m ago`;
  if (diffDay === 0) return `${diffHr}h ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  return then.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
