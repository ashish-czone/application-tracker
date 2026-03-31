import { useState, useMemo } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Trash2,
  Inbox,
  RefreshCw,
  Mail,
  MessageCircle,
  Clock,
  Activity,
  ChevronLeft,
} from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { cn, Button } from '@packages/ui';
import { DataGrid, useDataGridParams } from '@packages/ui';
import {
  useQueues,
  useQueueJobs,
  usePauseQueue,
  useResumeQueue,
  useRetryAllFailed,
  useCleanJobs,
  useRetryJob,
  useRemoveJob,
} from '../hooks';
import type { QueueSummary, QueueJob, JobStatus } from '../types';

// --- Constants ---

const STATUS_DOT: Record<string, string> = {
  waiting: 'bg-amber-400',
  active: 'bg-blue-500',
  completed: 'bg-emerald-500',
  failed: 'bg-red-500',
  delayed: 'bg-slate-400',
};

const STATUS_BADGE: Record<string, string> = {
  waiting: 'bg-amber-50 text-amber-700 ring-amber-200/60',
  active: 'bg-blue-50 text-blue-700 ring-blue-200/60',
  completed: 'bg-emerald-50 text-emerald-700 ring-emerald-200/60',
  failed: 'bg-red-50 text-red-700 ring-red-200/60',
  delayed: 'bg-slate-50 text-slate-600 ring-slate-200/60',
};

const QUEUE_ICONS: Record<string, typeof Mail> = {
  'notification.email': Mail,
  'notification.whatsapp': MessageCircle,
  'notification.schedule-scan': Clock,
};

const STATUS_OPTIONS = [
  { label: 'All', value: '' },
  { label: 'Waiting', value: 'waiting' },
  { label: 'Active', value: 'active' },
  { label: 'Completed', value: 'completed' },
  { label: 'Failed', value: 'failed' },
  { label: 'Delayed', value: 'delayed' },
];

// --- Helpers ---

function formatRelativeTime(ts: number | null): string {
  if (!ts) return '—';
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function formatDuration(start: number | null, end: number | null): string {
  if (!start || !end) return '—';
  const ms = end - start;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function queueDisplayName(name: string): string {
  const parts = name.split('.');
  return parts[parts.length - 1]
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// --- Queue Card ---

function QueueCard({
  queue,
  isSelected,
  onSelect,
}: {
  queue: QueueSummary;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const pauseMutation = usePauseQueue();
  const resumeMutation = useResumeQueue();

  const total = Object.values(queue.counts).reduce((s, n) => s + n, 0);
  const Icon = QUEUE_ICONS[queue.name] ?? Activity;

  const segments = [
    { key: 'active', count: queue.counts.active, color: 'bg-blue-500' },
    { key: 'waiting', count: queue.counts.waiting, color: 'bg-amber-400' },
    { key: 'delayed', count: queue.counts.delayed, color: 'bg-slate-300' },
    { key: 'failed', count: queue.counts.failed, color: 'bg-red-500' },
    { key: 'completed', count: queue.counts.completed, color: 'bg-emerald-400' },
  ];

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'group relative w-full text-left rounded-xl border bg-card p-5 transition-all duration-200',
        'hover:shadow-md hover:border-border/80',
        isSelected
          ? 'ring-2 ring-primary/30 border-primary/40 shadow-sm'
          : 'border-border/50',
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            'flex items-center justify-center h-9 w-9 rounded-lg transition-colors',
            isSelected ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
          )}>
            <Icon className="h-4.5 w-4.5" strokeWidth={1.75} />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">{queueDisplayName(queue.name)}</div>
            <div className="text-[11px] text-muted-foreground font-mono">{queue.name}</div>
          </div>
        </div>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {queue.isPaused ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-emerald-600"
              onClick={() => resumeMutation.mutate(queue.name)}
              disabled={resumeMutation.isPending}
              title="Resume queue"
            >
              <Play className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-amber-600"
              onClick={() => pauseMutation.mutate(queue.name)}
              disabled={pauseMutation.isPending}
              title="Pause queue"
            >
              <Pause className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      <div className="h-1.5 rounded-full bg-muted overflow-hidden flex mb-4">
        {total > 0 ? segments.map((s) =>
          s.count > 0 ? (
            <div
              key={s.key}
              className={cn('h-full transition-all duration-500', s.color)}
              style={{ width: `${(s.count / total) * 100}%` }}
            />
          ) : null,
        ) : (
          <div className="h-full w-full bg-muted" />
        )}
      </div>

      <div className="grid grid-cols-5 gap-1">
        {([
          { key: 'waiting', label: 'Wait', count: queue.counts.waiting },
          { key: 'active', label: 'Active', count: queue.counts.active },
          { key: 'completed', label: 'Done', count: queue.counts.completed },
          { key: 'failed', label: 'Failed', count: queue.counts.failed },
          { key: 'delayed', label: 'Delay', count: queue.counts.delayed },
        ] as const).map((s) => (
          <div key={s.key} className="text-center py-1">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <div className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[s.key])} />
              <span className="text-sm font-semibold tabular-nums text-foreground">{s.count}</span>
            </div>
            <div className="text-[10px] text-muted-foreground leading-none">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/40">
        <span className="text-[11px] text-muted-foreground tabular-nums">{total.toLocaleString()} total jobs</span>
        {queue.isPaused && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 bg-amber-50 rounded-full px-2 py-0.5">
            <Pause className="h-2.5 w-2.5" />
            Paused
          </span>
        )}
      </div>
    </button>
  );
}

// --- Job List with DataGrid ---

function JobList({ queueName, onBack }: { queueName: string; onBack: () => void }) {
  const [statusFilter, setStatusFilter] = useState<JobStatus | undefined>();
  const retryAllMutation = useRetryAllFailed();
  const cleanMutation = useCleanJobs();
  const retryMutation = useRetryJob();
  const removeMutation = useRemoveJob();

  const gridParams = useDataGridParams({
    defaultSort: 'timestamp',
    defaultOrder: 'desc',
    defaultPageSize: 25,
  });

  const { data, isLoading, isError, refetch } = useQueueJobs(queueName, {
    start: (gridParams.page - 1) * gridParams.pageSize,
    limit: gridParams.pageSize,
    status: statusFilter,
  });

  const jobs = data?.data ?? [];
  const total = data?.meta.total ?? 0;

  const columns = useMemo<ColumnDef<QueueJob, unknown>[]>(() => [
    {
      id: 'id',
      header: 'Job ID',
      accessorKey: 'id',
      size: 100,
      cell: ({ getValue }) => (
        <span className="font-mono text-xs text-muted-foreground">{getValue() as string}</span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      accessorKey: 'status',
      size: 110,
      cell: ({ getValue }) => {
        const status = getValue() as string;
        return (
          <span className={cn(
            'inline-flex items-center gap-1.5 rounded-md ring-1 ring-inset px-2 py-0.5 text-[11px] font-medium',
            STATUS_BADGE[status] || 'bg-muted text-muted-foreground ring-border',
          )}>
            <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[status] || 'bg-muted-foreground')} />
            {status}
          </span>
        );
      },
    },
    {
      id: 'timestamp',
      header: 'Created',
      accessorKey: 'timestamp',
      size: 120,
      cell: ({ getValue }) => (
        <span
          className="text-muted-foreground"
          title={getValue() ? new Date(getValue() as number).toISOString() : ''}
        >
          {formatRelativeTime(getValue() as number | null)}
        </span>
      ),
    },
    {
      id: 'duration',
      header: 'Duration',
      size: 90,
      accessorFn: (row) => formatDuration(row.processedOn, row.finishedOn),
      cell: ({ getValue }) => (
        <span className="text-muted-foreground tabular-nums">{getValue() as string}</span>
      ),
    },
    {
      id: 'attemptsMade',
      header: 'Attempts',
      accessorKey: 'attemptsMade',
      size: 80,
      cell: ({ getValue }) => (
        <span className="text-muted-foreground tabular-nums">{getValue() as number}</span>
      ),
    },
    {
      id: 'failedReason',
      header: 'Error',
      accessorKey: 'failedReason',
      cell: ({ getValue }) => {
        const reason = getValue() as string | null;
        return reason
          ? <span className="text-red-600/80 truncate block max-w-[220px]" title={reason}>{reason}</span>
          : <span className="text-muted-foreground/40">—</span>;
      },
    },
    {
      id: 'actions',
      header: '',
      size: 90,
      enableHiding: false,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-0.5 justify-end">
          {row.original.status === 'failed' && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-primary"
              onClick={() => retryMutation.mutate({ queueName, jobId: row.original.id })}
              disabled={retryMutation.isPending}
              title="Retry job"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => removeMutation.mutate({ queueName, jobId: row.original.id })}
            disabled={removeMutation.isPending}
            title="Remove job"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ], [queueName, retryMutation, removeMutation]);

  return (
    <div className="mt-8">
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div>
            <h2 className="text-sm font-semibold text-foreground">{queueDisplayName(queueName)}</h2>
            <p className="text-[11px] text-muted-foreground font-mono">{queueName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => retryAllMutation.mutate(queueName)}
            disabled={retryAllMutation.isPending}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Retry Failed
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => cleanMutation.mutate({ name: queueName, status: 'completed' })}
            disabled={cleanMutation.isPending}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Clean Completed
          </Button>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-border">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => { setStatusFilter(opt.value as JobStatus || undefined); gridParams.setPage(1); }}
            className={cn(
              'relative px-3 py-2 text-xs font-medium transition-colors',
              (statusFilter ?? '') === opt.value
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span className="flex items-center gap-1.5">
              {opt.value && (
                <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[opt.value])} />
              )}
              {opt.label}
            </span>
            {(statusFilter ?? '') === opt.value && (
              <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        ))}
      </div>

      <DataGrid
        columns={columns}
        data={jobs}
        getRowId={(row) => row.id}
        page={gridParams.page}
        pageSize={gridParams.pageSize}
        pageCount={Math.ceil(total / gridParams.pageSize)}
        totalRows={total}
        onPageChange={gridParams.setPage}
        onPageSizeChange={gridParams.setPageSize}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        emptyState={{
          icon: Inbox,
          title: 'No jobs found',
          description: statusFilter ? `No ${statusFilter} jobs in this queue` : 'This queue is empty',
        }}
        storageKey="queue-dashboard-jobs"
      />
    </div>
  );
}

// --- Main Page ---

export function QueueDashboardPage() {
  const { data: queues, isLoading, isError, refetch } = useQueues();
  const [selectedQueue, setSelectedQueue] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="max-w-6xl space-y-6">
        <div>
          <div className="h-5 w-32 animate-pulse rounded bg-muted mb-2" />
          <div className="h-3.5 w-56 animate-pulse rounded bg-muted" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-[180px] animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !queues) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="h-12 w-12 rounded-xl bg-red-50 flex items-center justify-center mb-4">
          <Activity className="h-6 w-6 text-red-500" />
        </div>
        <h2 className="text-sm font-semibold mb-1">Failed to load queues</h2>
        <p className="text-xs text-muted-foreground mb-4 max-w-xs">
          Could not connect to the queue system. Make sure Redis is running.
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Retry
        </Button>
      </div>
    );
  }

  if (queues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mb-4">
          <Inbox className="h-6 w-6 text-muted-foreground" />
        </div>
        <h2 className="text-sm font-semibold mb-1">No queues registered</h2>
        <p className="text-xs text-muted-foreground max-w-xs">
          Queues will appear here once job processors are registered with the system.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Queued Tasks</h1>
          <p className="text-sm text-muted-foreground">
            {queues.length} queue{queues.length !== 1 ? 's' : ''} registered
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          Live
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {queues.map((q) => (
          <QueueCard
            key={q.name}
            queue={q}
            isSelected={selectedQueue === q.name}
            onSelect={() => setSelectedQueue(selectedQueue === q.name ? null : q.name)}
          />
        ))}
      </div>

      {selectedQueue && (
        <JobList
          queueName={selectedQueue}
          onBack={() => setSelectedQueue(null)}
        />
      )}
    </div>
  );
}
