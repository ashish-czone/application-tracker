import { useState } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { cn, Badge, Button } from '@packages/ui';
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2, Zap, History } from 'lucide-react';
import { useAuditLogs } from '../hooks';
import type { AuditLogEntry } from '../types';

interface AuditTimelineProps {
  entityType: string;
  entityId: string;
}

const ACTION_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  created: { label: 'Created', icon: Plus, variant: 'default' },
  updated: { label: 'Updated', icon: Pencil, variant: 'secondary' },
  deleted: { label: 'Deleted', icon: Trash2, variant: 'destructive' },
};

function getActionConfig(action: string) {
  return ACTION_CONFIG[action] ?? { label: action, icon: Zap, variant: 'outline' as const };
}

function formatChangeValue(value: unknown): string {
  if (value === null || value === undefined) return '(empty)';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function ChangeDetails({ entry }: { entry: AuditLogEntry }) {
  const [expanded, setExpanded] = useState(false);

  if (!entry.changes || Object.keys(entry.changes).length === 0) return null;

  const changes = Object.entries(entry.changes);

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {changes.length} field{changes.length !== 1 ? 's' : ''} changed
      </button>
      {expanded && (
        <div className="mt-1.5 space-y-1 text-xs">
          {changes.map(([field, { from, to }]) => (
            <div key={field} className="flex items-baseline gap-1.5 text-muted-foreground">
              <span className="font-medium text-foreground">{field}</span>
              <span className="line-through">{formatChangeValue(from)}</span>
              <span>&rarr;</span>
              <span className="text-foreground">{formatChangeValue(to)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TimelineEntry({ entry }: { entry: AuditLogEntry }) {
  const config = getActionConfig(entry.action);
  const Icon = config.icon;
  const occurredAt = new Date(entry.occurredAt);

  return (
    <div className="flex gap-3 py-3">
      <div className="flex flex-col items-center">
        <div className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
          entry.action === 'created' && 'bg-primary/10 text-primary',
          entry.action === 'updated' && 'bg-muted text-muted-foreground',
          entry.action === 'deleted' && 'bg-destructive/10 text-destructive',
          !ACTION_CONFIG[entry.action] && 'bg-muted text-muted-foreground',
        )}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1 w-px bg-border mt-1" />
      </div>
      <div className="flex-1 min-w-0 pb-2">
        <div className="flex items-center gap-2">
          <Badge variant={config.variant} className="text-[10px] px-1.5 py-0">
            {config.label}
          </Badge>
          <span
            className="text-xs text-muted-foreground"
            title={format(occurredAt, 'PPpp')}
          >
            {formatDistanceToNow(occurredAt, { addSuffix: true })}
          </span>
        </div>
        <ChangeDetails entry={entry} />
      </div>
    </div>
  );
}

export function AuditTimeline({ entityType, entityId }: AuditTimelineProps) {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useAuditLogs({
    entityType,
    entityId,
    page,
    limit: 25,
  });

  if (isLoading) {
    return (
      <div className="space-y-4 py-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <div className="h-7 w-7 rounded-full bg-muted animate-pulse shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-24 bg-muted animate-pulse rounded" />
              <div className="h-3 w-48 bg-muted animate-pulse rounded" />
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

  const entries = data?.data ?? [];
  const meta = data?.meta;

  if (entries.length === 0) {
    return (
      <div className="text-center py-12">
        <History className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="divide-y-0">
        {entries.map((entry) => (
          <TimelineEntry key={entry.id} entry={entry} />
        ))}
      </div>
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
