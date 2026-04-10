import { useState, useMemo, type ReactNode } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { Button, cn } from '@packages/ui';
import { History, MessageSquare, Star, Paperclip, GitBranch, LayoutList } from 'lucide-react';
import { useAuditLogs, useEntityActivity } from '../hooks';
import type { AuditLogEntry, ActivityEventCategory } from '../types';

type FilterKey = 'all' | ActivityEventCategory;

const FILTER_TABS: { key: FilterKey; label: string; icon: ReactNode }[] = [
  { key: 'all', label: 'All', icon: <LayoutList className="h-3.5 w-3.5" /> },
  { key: 'notes', label: 'Notes', icon: <MessageSquare className="h-3.5 w-3.5" /> },
  { key: 'evaluations', label: 'Feedback', icon: <Star className="h-3.5 w-3.5" /> },
  { key: 'attachments', label: 'Files', icon: <Paperclip className="h-3.5 w-3.5" /> },
  { key: 'transitions', label: 'Stages', icon: <GitBranch className="h-3.5 w-3.5" /> },
  { key: 'changes', label: 'Changes', icon: <History className="h-3.5 w-3.5" /> },
];

interface AuditTimelineProps {
  entityType: string;
  entityId: string;
  /** 'audit' shows only direct entity changes; 'activity' includes related notes/evaluations/attachments */
  mode?: 'audit' | 'activity';
}

// --- Event category detection ---

function getEventCategory(entry: AuditLogEntry): ActivityEventCategory {
  const name = entry.eventName;
  if (name.startsWith('notes.')) return 'notes';
  if (name.startsWith('evaluations.')) return 'evaluations';
  if (name.startsWith('attachments.')) return 'attachments';
  if (name.endsWith('Changed') && entry.after && ('fromState' in entry.after || 'toState' in entry.after)) return 'transitions';
  return 'changes';
}

// --- Event-type-specific rendering ---

interface EventStyle {
  icon: ReactNode;
  colorClass: string;
}

function getEventStyle(category: ActivityEventCategory): EventStyle {
  switch (category) {
    case 'notes':
      return { icon: <MessageSquare className="h-3 w-3" />, colorClass: 'bg-emerald-500/80 text-white' };
    case 'evaluations':
      return { icon: <Star className="h-3 w-3" />, colorClass: 'bg-amber-500/80 text-white' };
    case 'attachments':
      return { icon: <Paperclip className="h-3 w-3" />, colorClass: 'bg-purple-500/80 text-white' };
    case 'transitions':
      return { icon: <GitBranch className="h-3 w-3" />, colorClass: 'bg-blue-500/80 text-white' };
    default:
      return { icon: <History className="h-3 w-3" />, colorClass: 'bg-muted-foreground/50 text-white' };
  }
}

function buildActivityDescription(entry: AuditLogEntry, category: ActivityEventCategory): string[] {
  switch (category) {
    case 'notes': {
      const action = entry.action === 'created' ? 'added' : entry.action === 'deleted' ? 'deleted' : 'updated';
      const content = (entry.after as Record<string, unknown>)?.content as string | undefined;
      const lines = [`Note ${action}`];
      if (content && action !== 'deleted') {
        const excerpt = content.length > 120 ? `${content.slice(0, 120)}...` : content;
        lines.push(excerpt);
      }
      return lines;
    }
    case 'evaluations': {
      const action = entry.action === 'submitted' ? 'submitted' : entry.action === 'deleted' ? 'deleted' : 'updated';
      const after = entry.after as Record<string, unknown> | null;
      const rating = after?.overallRating as number | undefined;
      const templateSlug = after?.templateSlug as string | undefined;
      let line = `Evaluation ${action}`;
      if (rating) line += ` — ${rating}/5`;
      if (templateSlug) line += ` (${templateSlug})`;
      return [line];
    }
    case 'attachments': {
      const action = entry.action === 'created' ? 'uploaded' : 'deleted';
      const after = (entry.after ?? entry.before) as Record<string, unknown> | null;
      const fileName = after?.originalName as string | undefined;
      return [fileName ? `File ${action}: ${fileName}` : `File ${action}`];
    }
    case 'transitions': {
      const after = entry.after as Record<string, unknown> | null;
      const fromState = after?.fromState as string | undefined;
      const toState = after?.toState as string | undefined;
      const reason = after?.reason as string | undefined;
      let line = 'Stage changed';
      if (fromState && toState) line = `Stage: ${fromState} → ${toState}`;
      if (reason) line += ` (${reason})`;
      return [line];
    }
    default:
      return buildChangeLines(entry);
  }
}

// --- Shared helpers ---

function formatChangeValue(value: unknown): string {
  if (value === null || value === undefined) return '(empty)';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function formatDayHeader(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMM dd, yyyy');
}

function buildChangeLines(entry: AuditLogEntry): string[] {
  if (entry.action === 'created') return ['Record created'];
  if (entry.action === 'deleted') return ['Record deleted'];

  if (!entry.changes || Object.keys(entry.changes).length === 0) {
    return ['Record updated'];
  }

  return Object.entries(entry.changes)
    .filter(([field]) => !field.endsWith('__label'))
    .map(([field, { from, to }]) => {
      const labelChange = entry.changes![`${field}__label`];
      const fromDisplay = labelChange ? formatChangeValue(labelChange.from) : formatChangeValue(from);
      const toDisplay = labelChange ? formatChangeValue(labelChange.to) : formatChangeValue(to);
      return `${field} changed from ${fromDisplay} to ${toDisplay}`;
    });
}

function groupByDay(entries: AuditLogEntry[]): { day: string; entries: AuditLogEntry[] }[] {
  const groups: Map<string, AuditLogEntry[]> = new Map();
  for (const entry of entries) {
    const day = format(new Date(entry.occurredAt), 'yyyy-MM-dd');
    const existing = groups.get(day);
    if (existing) {
      existing.push(entry);
    } else {
      groups.set(day, [entry]);
    }
  }
  return Array.from(groups.entries()).map(([day, entries]) => ({ day, entries }));
}

// --- Timeline entry ---

function TimelineEntry({
  entry,
  showLine,
  isActivityMode,
}: {
  entry: AuditLogEntry;
  showLine: boolean;
  isActivityMode: boolean;
}) {
  const occurredAt = new Date(entry.occurredAt);
  const time = format(occurredAt, 'h:mm a');
  const category = getEventCategory(entry);
  const lines = isActivityMode ? buildActivityDescription(entry, category) : buildChangeLines(entry);
  const style = isActivityMode ? getEventStyle(category) : getEventStyle('changes');

  return (
    <div className="flex min-h-[40px]">
      {/* Time */}
      <div className="w-[90px] shrink-0 text-right pr-4 pt-[3px]">
        <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">{time}</span>
      </div>

      {/* Icon + line column */}
      <div className="relative w-5 shrink-0 flex flex-col items-center">
        {isActivityMode ? (
          <div className={cn('h-5 w-5 rounded-full shrink-0 mt-1 flex items-center justify-center', style.colorClass)}>
            {style.icon}
          </div>
        ) : (
          <div className="h-3 w-3 rounded-full bg-muted-foreground/50 shrink-0 mt-2" />
        )}
        {showLine && <div className="w-[2px] flex-1 bg-border" />}
      </div>

      {/* Description */}
      <div className="flex-1 min-w-0 pl-3 pb-4 pt-[2px]">
        {lines.map((line: string, i: number) => (
          <p
            key={i}
            className={cn(
              'text-sm leading-relaxed',
              i === 0 ? 'text-foreground/80' : 'text-muted-foreground text-xs mt-0.5',
            )}
          >
            {line}
          </p>
        ))}
        {entry.actorName && (
          <p className="text-xs text-muted-foreground mt-0.5">by {entry.actorName}</p>
        )}
      </div>
    </div>
  );
}

function DayHeader({ day, showLine }: { day: string; showLine: boolean }) {
  return (
    <div className="flex">
      <div className="w-[90px] shrink-0 text-right pr-4 py-2">
        <span className="text-[13px] font-semibold text-foreground whitespace-nowrap">
          {formatDayHeader(day)}
        </span>
      </div>
      <div className="relative w-5 shrink-0 flex flex-col items-center">
        {showLine && <div className="w-[2px] flex-1 bg-border" />}
      </div>
      <div className="flex-1 min-w-0 pl-3 py-2" />
    </div>
  );
}

// --- Main component ---

export function AuditTimeline({ entityType, entityId, mode = 'audit' }: AuditTimelineProps) {
  const isActivityMode = mode === 'activity';
  const [page, setPage] = useState(1);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');

  const auditQuery = useAuditLogs({ entityType, entityId, page, limit: 25 });
  const activityQuery = useEntityActivity(entityType, entityId, page);
  const { data, isLoading, isError, refetch } = isActivityMode ? activityQuery : auditQuery;

  const allEntries = useMemo(() => data?.data ?? [], [data?.data]);

  // Count entries per category for tab badges
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const entry of allEntries) {
      const cat = getEventCategory(entry);
      counts[cat] = (counts[cat] ?? 0) + 1;
    }
    return counts;
  }, [allEntries]);

  const filteredEntries = useMemo(() => {
    if (activeFilter === 'all') return allEntries;
    return allEntries.filter((entry) => getEventCategory(entry) === activeFilter);
  }, [allEntries, activeFilter]);

  const dayGroups = useMemo(() => groupByDay(filteredEntries), [filteredEntries]);

  if (isLoading) {
    return (
      <div className="space-y-5 py-4">
        {Array.from({ length: 5 }).map((_, i: number) => (
          <div key={i} className="flex">
            <div className="w-[90px] shrink-0 pr-4">
              <div className="h-3 w-14 bg-muted animate-pulse rounded ml-auto" />
            </div>
            <div className="w-5 shrink-0 flex justify-center">
              <div className="h-[10px] w-[10px] rounded-full bg-muted animate-pulse" />
            </div>
            <div className="flex-1 pl-3">
              <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted-foreground">Failed to load activity.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2">
          Retry
        </Button>
      </div>
    );
  }

  if (dayGroups.length === 0) {
    return (
      <div>
        <div className="text-center py-12">
          <History className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
        </div>
      </div>
    );
  }

  const meta = data?.meta;
  const lastEntryId = filteredEntries.length > 0 ? filteredEntries[filteredEntries.length - 1].id : null;

  return (
    <div>
      {/* Category filter tabs — only in activity mode */}
      {isActivityMode && (
        <div className="flex items-center gap-1 mb-4 flex-wrap">
          {FILTER_TABS.map((tab) => {
            const count = tab.key === 'all' ? allEntries.length : (categoryCounts[tab.key] ?? 0);
            const isActive = activeFilter === tab.key;
            if (tab.key !== 'all' && count === 0) return null;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveFilter(tab.key)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {tab.icon}
                {tab.label}
                {count > 0 && (
                  <span className={cn(
                    'inline-flex items-center justify-center h-4 min-w-[16px] rounded-full px-1 text-[10px] font-semibold',
                    isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-background text-muted-foreground',
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Filtered empty state */}
      {activeFilter !== 'all' && filteredEntries.length === 0 && (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground">No {FILTER_TABS.find(t => t.key === activeFilter)?.label.toLowerCase()} activity on this page.</p>
          <Button variant="outline" size="sm" onClick={() => setActiveFilter('all')} className="mt-2">
            Show all activity
          </Button>
        </div>
      )}

      {dayGroups.map((group: { day: string; entries: AuditLogEntry[] }, groupIdx: number) => (
        <div key={group.day}>
          <DayHeader
            day={group.day}
            showLine={groupIdx > 0 || group.entries.length > 0}
          />
          {group.entries.map((entry: AuditLogEntry) => (
            <TimelineEntry
              key={entry.id}
              entry={entry}
              showLine={entry.id !== lastEntryId}
              isActivityMode={isActivityMode}
            />
          ))}
        </div>
      ))}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 mt-2 border-t">
          <p className="text-xs text-muted-foreground">
            Page {meta.page} of {meta.totalPages} ({meta.total} entries)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p: number) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p: number) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
