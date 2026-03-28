import { useState, useMemo } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { cn, Button } from '@packages/ui';
import { History } from 'lucide-react';
import { useAuditLogs } from '../hooks';
import type { AuditLogEntry } from '../types';

interface AuditTimelineProps {
  entityType: string;
  entityId: string;
}

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

  return Object.entries(entry.changes).map(([field, { from, to }]) =>
    `${field} changed from ${formatChangeValue(from)} to ${formatChangeValue(to)}`,
  );
}

function TimelineEntry({ entry, isLast }: { entry: AuditLogEntry; isLast: boolean }) {
  const occurredAt = new Date(entry.occurredAt);
  const time = format(occurredAt, 'h:mm a');
  const lines = buildChangeLines(entry);

  return (
    <div className="flex">
      {/* Time — left of the line */}
      <div className="w-24 shrink-0 text-right pr-4 pt-0.5">
        <span className="text-xs text-muted-foreground tabular-nums">{time}</span>
      </div>

      {/* Dot + vertical line */}
      <div className="relative flex flex-col items-center w-6 shrink-0">
        {!isLast && (
          <div className="absolute top-0 bottom-0 left-1/2 w-px -translate-x-1/2 bg-border" />
        )}
        <div className={cn(
          'relative z-10 mt-1 h-3.5 w-3.5 rounded-full border-[3px] border-background',
          entry.action === 'created' && 'bg-primary',
          entry.action === 'deleted' && 'bg-destructive',
          entry.action !== 'created' && entry.action !== 'deleted' && 'bg-muted-foreground/60',
        )} />
      </div>

      {/* Action description — right of the line */}
      <div className="flex-1 min-w-0 pl-3 pb-6">
        {lines.map((line, i) => (
          <p key={i} className="text-sm text-foreground leading-relaxed">{line}</p>
        ))}
      </div>
    </div>
  );
}

function DayHeader({ day, isFirst }: { day: string; isFirst: boolean }) {
  return (
    <div className="flex">
      {/* Date — left of the line, bold */}
      <div className="w-24 shrink-0 text-right pr-4 pt-px">
        <span className="text-sm font-bold text-foreground">{formatDayHeader(day)}</span>
      </div>

      {/* Vertical line continues through the header */}
      <div className="relative flex flex-col items-center w-6 shrink-0">
        <div className={cn(
          'absolute left-1/2 w-px -translate-x-1/2 bg-border',
          isFirst ? 'top-1/2 bottom-0' : 'top-0 bottom-0',
        )} />
      </div>

      {/* Spacer */}
      <div className="flex-1 min-w-0 pl-3 py-3" />
    </div>
  );
}

/** Group audit entries by calendar day */
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

export function AuditTimeline({ entityType, entityId }: AuditTimelineProps) {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useAuditLogs({
    entityType,
    entityId,
    page,
    limit: 25,
  });

  const dayGroups = useMemo(() => {
    if (!data?.data) return [];
    return groupByDay(data.data);
  }, [data?.data]);

  if (isLoading) {
    return (
      <div className="space-y-5 py-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex">
            <div className="w-24 shrink-0 pr-4">
              <div className="h-3 w-14 bg-muted animate-pulse rounded ml-auto" />
            </div>
            <div className="w-6 shrink-0 flex justify-center">
              <div className="h-3.5 w-3.5 rounded-full bg-muted animate-pulse" />
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
        <p className="text-sm text-muted-foreground">Failed to load audit trail.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2">
          Retry
        </Button>
      </div>
    );
  }

  if (dayGroups.length === 0) {
    return (
      <div className="text-center py-12">
        <History className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
      </div>
    );
  }

  const meta = data?.meta;
  const allEntries = data?.data ?? [];
  const lastEntryId = allEntries.length > 0 ? allEntries[allEntries.length - 1].id : null;

  return (
    <div>
      {dayGroups.map((group, groupIdx) => (
        <div key={group.day}>
          <DayHeader day={group.day} isFirst={groupIdx === 0} />
          {group.entries.map((entry) => (
            <TimelineEntry
              key={entry.id}
              entry={entry}
              isLast={entry.id === lastEntryId}
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
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
