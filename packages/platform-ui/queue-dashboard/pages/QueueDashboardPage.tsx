import { useState, useMemo } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Trash2,
  Inbox,
  RefreshCw,
  ChevronLeft,
  Activity,
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

function CountCell({ value, color }: { value: number; color?: string }) {
  return (
    <span className={cn('tabular-nums font-medium', value > 0 ? color : 'text-muted-foreground/40')}>
      {value}
    </span>
  );
}

// --- Queues Table ---

function QueuesTable({ onSelect }: { onSelect: (name: string) => void }) {
  const { data: queues, isLoading, isError, refetch } = useQueues();
  const pauseMutation = usePauseQueue();
  const resumeMutation = useResumeQueue();

  const columns = useMemo<ColumnDef<QueueSummary, unknown>[]>(() => [
    {
      id: 'name',
      header: 'Queue',
      accessorKey: 'name',
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => onSelect(row.original.name)}
          className="text-left hover:underline"
        >
          <div className="text-sm font-medium text-primary">{queueDisplayName(row.original.name)}</div>
          <div className="text-[11px] text-muted-foreground font-mono">{row.original.name}</div>
        </button>
      ),
    },
    {
      id: 'waiting',
      header: 'Waiting',
      size: 90,
      accessorFn: (row) => row.counts.waiting,
      cell: ({ getValue }) => <CountCell value={getValue() as number} color="text-amber-600" />,
    },
    {
      id: 'active',
      header: 'Active',
      size: 90,
      accessorFn: (row) => row.counts.active,
      cell: ({ getValue }) => <CountCell value={getValue() as number} color="text-blue-600" />,
    },
    {
      id: 'completed',
      header: 'Completed',
      size: 100,
      accessorFn: (row) => row.counts.completed,
      cell: ({ getValue }) => <CountCell value={getValue() as number} color="text-emerald-600" />,
    },
    {
      id: 'failed',
      header: 'Failed',
      size: 90,
      accessorFn: (row) => row.counts.failed,
      cell: ({ getValue }) => <CountCell value={getValue() as number} color="text-red-600" />,
    },
    {
      id: 'delayed',
      header: 'Delayed',
      size: 90,
      accessorFn: (row) => row.counts.delayed,
      cell: ({ getValue }) => <CountCell value={getValue() as number} color="text-slate-500" />,
    },
    {
      id: 'total',
      header: 'Total',
      size: 90,
      accessorFn: (row) => Object.values(row.counts).reduce((s, n) => s + n, 0),
      cell: ({ getValue }) => (
        <span className="tabular-nums font-semibold">{(getValue() as number).toLocaleString()}</span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      size: 90,
      accessorKey: 'isPaused',
      cell: ({ row }) => (
        row.original.isPaused
          ? <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 bg-amber-50 rounded-full px-2 py-0.5">Paused</span>
          : <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 rounded-full px-2 py-0.5">Active</span>
      ),
    },
    {
      id: 'actions',
      header: '',
      size: 70,
      enableHiding: false,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-0.5 justify-end">
          {row.original.isPaused ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-emerald-600"
              onClick={(e) => { e.stopPropagation(); resumeMutation.mutate(row.original.name); }}
              disabled={resumeMutation.isPending}
              title="Resume"
            >
              <Play className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-amber-600"
              onClick={(e) => { e.stopPropagation(); pauseMutation.mutate(row.original.name); }}
              disabled={pauseMutation.isPending}
              title="Pause"
            >
              <Pause className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ], [pauseMutation, resumeMutation]);

  return (
    <DataGrid
      columns={columns}
      data={queues ?? []}
      getRowId={(row) => row.name}
      page={1}
      pageSize={100}
      pageCount={1}
      totalRows={queues?.length ?? 0}
      onPageChange={() => {}}
      onPageSizeChange={() => {}}
      isLoading={isLoading}
      isError={isError}
      onRetry={refetch}
      emptyState={{
        icon: Inbox,
        title: 'No queues registered',
        description: 'Queues will appear here once job processors are registered with the system.',
      }}
    />
  );
}

// --- Jobs Table ---

function JobsTable({ queueName, onBack }: { queueName: string; onBack: () => void }) {
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
        <span className="text-muted-foreground" title={getValue() ? new Date(getValue() as number).toISOString() : ''}>
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
    <div>
      {/* Header with back button */}
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
  const [selectedQueue, setSelectedQueue] = useState<string | null>(null);

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Queued Tasks</h1>
          <p className="text-sm text-muted-foreground">Monitor and manage background job queues</p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          Live
        </div>
      </div>

      {selectedQueue ? (
        <JobsTable queueName={selectedQueue} onBack={() => setSelectedQueue(null)} />
      ) : (
        <QueuesTable onSelect={setSelectedQueue} />
      )}
    </div>
  );
}
