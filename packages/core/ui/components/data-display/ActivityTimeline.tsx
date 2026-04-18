import type { LucideIcon } from 'lucide-react';
import { Clock } from 'lucide-react';

// ─── Public types ───────────────────────────────────────────────────

export interface TimelineEvent {
  id: string;
  type: string;
  actor: { name: string; initials: string; color?: string };
  timestamp: string; // ISO
  detail: string;
}

export interface TimelineIconConfig {
  icon: LucideIcon;
  bg: string;
  ring: string;
  iconColor: string;
}

export interface ActivityTimelineProps {
  events: TimelineEvent[];
  /** Map from event.type to icon + color config. Falls back to a neutral clock icon. */
  iconConfig: Record<string, TimelineIconConfig>;
  /**
   * `"classic"` — 3-column layout (actor+time | line+icon | detail) with date
   * group headers. Best for drawers and wide panels.
   *
   * `"feed"` — 2-column layout (line+icon | detail + actor + relative time).
   * Best for sidebars and compact cards.
   *
   * @default "classic"
   */
  variant?: 'classic' | 'feed';
  /** Label shown in the empty state. */
  emptyLabel?: string;
  /** Secondary label shown below the empty state. */
  emptyHint?: string;
}

// ─── Fallback icon config ───────────────────────────────────────────

const FALLBACK_CONFIG: TimelineIconConfig = {
  icon: Clock,
  bg: 'bg-ink/5',
  ring: 'ring-ink/15',
  iconColor: 'text-ink-muted',
};

// ─── Helpers ────────────────────────────────────────────────────────

type TimelineRow =
  | { kind: 'date'; date: string; label: string }
  | { kind: 'event'; event: TimelineEvent };

function buildTimeline(events: TimelineEvent[]): TimelineRow[] {
  const sorted = [...events].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
  const rows: TimelineRow[] = [];
  let prevDate = '';
  for (const event of sorted) {
    const dateKey = new Date(event.timestamp).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    if (dateKey !== prevDate) {
      rows.push({ kind: 'date', date: dateKey, label: dateKey });
      prevDate = dateKey;
    }
    rows.push({ kind: 'event', event });
  }
  return rows;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function formatRelativeTime(iso: string): string {
  const now = new Date('2026-04-17T12:00:00Z').getTime();
  const diff = now - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

// ─── Empty state ────────────────────────────────────────────────────

function EmptyTimeline({
  label,
  hint,
}: {
  label: string;
  hint: string;
}) {
  return (
    <div className="text-center py-12 px-6">
      <div className="w-10 h-10 mx-auto mb-3 bg-paper-sunken border border-rule flex items-center justify-center">
        <Clock className="w-5 h-5 text-ink-muted/40" strokeWidth={1} />
      </div>
      <p className="text-sm text-ink-muted font-sans">{label}</p>
      <p className="text-[11px] text-ink-muted/60 font-sans mt-1">{hint}</p>
    </div>
  );
}

// ─── Classic variant (3-column, date headers) ───────────────────────

function ClassicTimeline({
  events,
  iconConfig,
}: {
  events: TimelineEvent[];
  iconConfig: Record<string, TimelineIconConfig>;
}) {
  const rows = buildTimeline(events);

  return (
    <div>
      {rows.map((row, idx) => {
        if (row.kind === 'date') {
          return (
            <div key={`d-${row.date}`} className="flex min-h-[28px]">
              <div className="w-[100px] shrink-0" />
              <div className="w-5 shrink-0 flex flex-col items-center">
                <div className="w-[2px] flex-1 bg-rule/50" />
              </div>
              <div className="flex-1 min-w-0 pl-3 flex items-center">
                <span className="text-[10px] font-sans font-semibold tracking-widest uppercase text-ink-muted/70">
                  {row.label}
                </span>
              </div>
            </div>
          );
        }

        const { event } = row;
        const config = iconConfig[event.type] ?? FALLBACK_CONFIG;
        const Icon = config.icon;

        return (
          <div key={event.id} className="flex min-h-[56px]">
            {/* Left column: actor + time */}
            <div className="w-[100px] shrink-0 text-right pr-4 flex flex-col justify-center">
              <div className="text-[11px] font-sans font-medium text-ink truncate">
                {event.actor.name}
              </div>
              <div className="text-[10px] font-mono tabular-nums text-ink-muted whitespace-nowrap">
                {formatTime(event.timestamp)}
              </div>
            </div>

            {/* Center column: line + circle + line */}
            <div className="w-5 shrink-0 flex flex-col items-center">
              <div className="w-[2px] flex-1 bg-rule/50" />
              <span
                className={`w-5 h-5 shrink-0 flex items-center justify-center ring-1 z-10 ${config.bg} ${config.ring}`}
              >
                <Icon className={`w-2.5 h-2.5 ${config.iconColor}`} strokeWidth={2} />
              </span>
              <div className="w-[2px] flex-1 bg-rule/50" />
            </div>

            {/* Right column: detail */}
            <div className="flex-1 min-w-0 pl-3 flex items-center">
              <p className="text-sm text-ink font-sans leading-relaxed">
                {event.detail}
              </p>
            </div>
          </div>
        );
      })}

      {/* Tail connector */}
      <div className="flex h-3">
        <div className="w-[100px] shrink-0" />
        <div className="w-5 shrink-0 flex flex-col items-center">
          <div className="w-[2px] flex-1 bg-rule/50" />
        </div>
        <div className="flex-1" />
      </div>
    </div>
  );
}

// ─── Feed variant (2-column, relative time) ─────────────────────────

function FeedTimeline({
  events,
  iconConfig,
}: {
  events: TimelineEvent[];
  iconConfig: Record<string, TimelineIconConfig>;
}) {
  const sorted = [...events].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  return (
    <div>
      {sorted.map((event, idx) => {
        const config = iconConfig[event.type] ?? FALLBACK_CONFIG;
        const Icon = config.icon;
        const isLast = idx === sorted.length - 1;

        return (
          <div key={event.id} className="flex gap-3">
            {/* Timeline line + icon */}
            <div className="flex flex-col items-center">
              <span
                className={`w-5 h-5 flex-none flex items-center justify-center ring-1 ${config.bg} ${config.ring}`}
              >
                <Icon className={`w-2.5 h-2.5 ${config.iconColor}`} strokeWidth={2} />
              </span>
              {!isLast && <div className="w-[2px] flex-1 bg-rule/50" />}
            </div>
            {/* Content */}
            <div className="pb-4 min-w-0">
              <p className="text-sm text-ink font-sans leading-snug">{event.detail}</p>
              <p className="text-[11px] text-ink-muted font-sans mt-0.5">
                {event.actor.name} &middot; {formatRelativeTime(event.timestamp)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────

export function ActivityTimeline({
  events,
  iconConfig,
  variant = 'classic',
  emptyLabel = 'No activity recorded',
  emptyHint = 'Actions will appear here.',
}: ActivityTimelineProps) {
  if (events.length === 0) {
    return <EmptyTimeline label={emptyLabel} hint={emptyHint} />;
  }

  return variant === 'classic' ? (
    <ClassicTimeline events={events} iconConfig={iconConfig} />
  ) : (
    <FeedTimeline events={events} iconConfig={iconConfig} />
  );
}
