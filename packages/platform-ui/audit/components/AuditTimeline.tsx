import { useState, useMemo } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { cn, Button } from '@packages/ui';
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2, Zap, History } from 'lucide-react';
import { useAuditLogs } from '../hooks';
import type { AuditLogEntry } from '../types';

interface AuditTimelineProps {
  entityType: string;
  entityId: string;
}

const ACTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  created: Plus,
  updated: Pencil,
  deleted: Trash2,
};

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
  return format(date, 'MMM d, yyyy');
}

function buildActionSummary(entry: AuditLogEntry): string {
  if (entry.action === 'created') return 'Record created';
  if (entry.action === 'deleted') return 'Record deleted';

  if (entry.changes && Object.keys(entry.changes).length > 0) {
    const fields = Object.keys(entry.changes);
    if (fields.length === 1) {
      const field = fields[0];
      const { from, to } = entry.changes[field];
      return `${field} changed from ${formatChangeValue(from)} to ${formatChangeValue(to)}`;
    }
    return `${fields.length} fields updated`;
  }

  return 'Record updated';
}

function ChangeDetails({ entry }: { entry: AuditLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  if (!entry.changes || Object.keys(entry.changes).length <= 1) return null;

  const changes = Object.entries(entry.changes);

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        Show details
      </button>
      {expanded && (
        <div className="mt-1.5 space-y-1 text-xs pl-4">
          {changes.map(([field, { from, to }]) => (
            <div key={field} className="text-muted-foreground">
              <span className="font-medium text-foreground">{field}</span>
              {' '}
              <span>changed from</span>
              {' '}
              <span className="line-through">{formatChangeValue(from)}</span>
              {' → '}
              <span className="text-foreground">{formatChangeValue(to)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TimelineEntry({ entry }: { entry: AuditLogEntry }) {
  const Icon = ACTION_ICONS[entry.action] ?? Zap;
  const occurredAt = new Date(entry.occurredAt);
  const time = format(occurredAt, 'h:mm a');
  const summary = buildActionSummary(entry);

  return (
    <div className="flex items-start gap-3 py-2.5">
      {/* Time on the left */}
      <span className="w-20 shrink-0 text-xs text-muted-foreground text-right pt-0.5 tabular-nums">
        {time}
      </span>

      {/* Icon in center */}
      <div className={cn(
        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full mt-0.5',
        entry.action === 'created' && 'bg-primary/10 text-primary',
        entry.action === 'updated' && 'bg-muted text-muted-foreground',
        entry.action === 'deleted' && 'bg-destructive/10 text-destructive',
        !ACTION_ICONS[entry.action] && 'bg-muted text-muted-foreground',
      )}>
        <Icon className="h-3 w-3" />
      </div>

      {/* Action description on the right */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground">{summary}</p>
        <ChangeDetails entry={entry} />
      </div>
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
      <div className="space-y-6 py-4">
        <div className="h-4 w-28 bg-muted animate-pulse rounded" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="w-20 h-3 bg-muted animate-pulse rounded" />
            <div className="h-6 w-6 rounded-full bg-muted animate-pulse shrink-0" />
            <div className="flex-1 h-4 bg-muted animate-pulse rounded" />
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

  return (
    <div>
      {dayGroups.map((group) => (
        <div key={group.day} className="mb-6">
          {/* Day header */}
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {formatDayHeader(group.day)}
            </h3>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Entries for this day */}
          <div className="divide-y divide-border">
            {group.entries.map((entry) => (
              <TimelineEntry key={entry.id} entry={entry} />
            ))}
          </div>
        </div>
      ))}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t">
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
