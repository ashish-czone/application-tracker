import { useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Trash2,
  ListTodo,
  ChevronDown,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { cn, Badge, Button } from '@packages/ui';
import { Card, CardContent } from '@packages/ui/components/layout/Card';
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

const STATUS_TABS: { label: string; value: JobStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Waiting', value: 'waiting' },
  { label: 'Active', value: 'active' },
  { label: 'Completed', value: 'completed' },
  { label: 'Failed', value: 'failed' },
  { label: 'Delayed', value: 'delayed' },
];

const STATUS_COLORS: Record<string, string> = {
  waiting: 'bg-amber-100 text-amber-800 border-amber-200',
  active: 'bg-blue-100 text-blue-800 border-blue-200',
  completed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  failed: 'bg-red-100 text-red-800 border-red-200',
  delayed: 'bg-slate-100 text-slate-700 border-slate-200',
};

function formatTime(ts: number | null): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString();
}

function formatDuration(start: number | null, end: number | null): string {
  if (!start || !end) return '—';
  const ms = end - start;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

// --- Queue Cards ---

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
  const statEntries: { label: string; value: number; color: string }[] = [
    { label: 'Waiting', value: queue.counts.waiting, color: 'text-amber-600' },
    { label: 'Active', value: queue.counts.active, color: 'text-blue-600' },
    { label: 'Completed', value: queue.counts.completed, color: 'text-emerald-600' },
    { label: 'Failed', value: queue.counts.failed, color: 'text-red-600' },
    { label: 'Delayed', value: queue.counts.delayed, color: 'text-slate-500' },
  ];

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md',
        isSelected && 'ring-2 ring-primary',
      )}
      onClick={onSelect}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold truncate">{queue.name}</span>
            {queue.isPaused && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Paused</Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {queue.isPaused ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => { e.stopPropagation(); resumeMutation.mutate(queue.name); }}
                disabled={resumeMutation.isPending}
                title="Resume"
              >
                <Play className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => { e.stopPropagation(); pauseMutation.mutate(queue.name); }}
                disabled={pauseMutation.isPending}
                title="Pause"
              >
                <Pause className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {statEntries.map((s) => (
            <div key={s.label} className="text-center">
              <div className={cn('text-base font-bold tabular-nums', s.color)}>{s.value}</div>
              <div className="text-[10px] text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="mt-2 text-[11px] text-muted-foreground text-right">{total} total</div>
      </CardContent>
    </Card>
  );
}

// --- Job List ---

function JobRow({
  job,
  queueName,
  isExpanded,
  onToggle,
}: {
  job: QueueJob;
  queueName: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const retryMutation = useRetryJob();
  const removeMutation = useRemoveJob();

  return (
    <>
      <tr
        className="border-b border-border hover:bg-muted/30 cursor-pointer text-[13px]"
        onClick={onToggle}
      >
        <td className="px-3 py-2">
          {isExpanded
            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        </td>
        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{job.id}</td>
        <td className="px-3 py-2">
          <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium', STATUS_COLORS[job.status] || 'bg-muted text-muted-foreground')}>
            {job.status}
          </span>
        </td>
        <td className="px-3 py-2 text-muted-foreground">{formatTime(job.timestamp)}</td>
        <td className="px-3 py-2 text-muted-foreground tabular-nums">{formatDuration(job.processedOn, job.finishedOn)}</td>
        <td className="px-3 py-2 text-muted-foreground tabular-nums">{job.attemptsMade}</td>
        <td className="px-3 py-2 text-muted-foreground truncate max-w-[200px]">{job.failedReason || '—'}</td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {job.status === 'failed' && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => retryMutation.mutate({ queueName, jobId: job.id })}
                disabled={retryMutation.isPending}
                title="Retry"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => removeMutation.mutate({ queueName, jobId: job.id })}
              disabled={removeMutation.isPending}
              title="Remove"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr className="border-b border-border bg-muted/20">
          <td colSpan={8} className="px-6 py-3">
            <div className="space-y-2 text-xs">
              {job.failedReason && (
                <div>
                  <span className="font-medium text-red-600">Error: </span>
                  <span className="text-muted-foreground">{job.failedReason}</span>
                </div>
              )}
              {job.stacktrace.length > 0 && (
                <div>
                  <span className="font-medium">Stacktrace:</span>
                  <pre className="mt-1 bg-muted rounded p-2 text-[11px] overflow-x-auto max-h-40">{job.stacktrace.join('\n')}</pre>
                </div>
              )}
              <div>
                <span className="font-medium">Data:</span>
                <pre className="mt-1 bg-muted rounded p-2 text-[11px] overflow-x-auto max-h-40">{JSON.stringify(job.data, null, 2)}</pre>
              </div>
              {job.returnvalue != null && (
                <div>
                  <span className="font-medium">Return value:</span>
                  <pre className="mt-1 bg-muted rounded p-2 text-[11px] overflow-x-auto max-h-40">{JSON.stringify(job.returnvalue, null, 2)}</pre>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function JobList({ queueName }: { queueName: string }) {
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'all'>('all');
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const limit = 25;
  const retryAllMutation = useRetryAllFailed();
  const cleanMutation = useCleanJobs();

  const { data, isLoading } = useQueueJobs(queueName, {
    start: page * limit,
    limit,
    status: statusFilter === 'all' ? undefined : statusFilter,
  });

  const jobs = data?.data ?? [];
  const total = data?.meta.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="mt-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3">
        {/* Status tabs */}
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => { setStatusFilter(tab.value); setPage(0); setExpandedId(null); }}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                statusFilter === tab.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => retryAllMutation.mutate(queueName)}
            disabled={retryAllMutation.isPending}
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry Failed
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => cleanMutation.mutate({ name: queueName, status: 'completed' })}
            disabled={cleanMutation.isPending}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Clean Completed
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/30 text-[12px] font-medium text-muted-foreground">
              <th className="px-3 py-2 w-8" />
              <th className="px-3 py-2 text-left">ID</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Created</th>
              <th className="px-3 py-2 text-left">Duration</th>
              <th className="px-3 py-2 text-left">Attempts</th>
              <th className="px-3 py-2 text-left">Error</th>
              <th className="px-3 py-2 w-20" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b">
                  <td colSpan={8} className="px-3 py-3">
                    <div className="h-4 animate-pulse rounded bg-muted" />
                  </td>
                </tr>
              ))
            ) : jobs.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  No jobs found
                </td>
              </tr>
            ) : (
              jobs.map((job) => (
                <JobRow
                  key={job.id}
                  job={job}
                  queueName={queueName}
                  isExpanded={expandedId === job.id}
                  onToggle={() => setExpandedId(expandedId === job.id ? null : job.id)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-muted-foreground">{total} jobs total</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {page + 1} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Main Page ---

export function QueueDashboardPage() {
  const { data: queues, isLoading, isError, refetch } = useQueues();
  const [selectedQueue, setSelectedQueue] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-48 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !queues) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <ListTodo className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold mb-1">Failed to load queues</h2>
        <p className="text-sm text-muted-foreground mb-4">Could not connect to the queue system.</p>
        <Button variant="outline" onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }

  if (queues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <ListTodo className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold mb-1">No queues registered</h2>
        <p className="text-sm text-muted-foreground">Queues will appear here once they are registered with the system.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      {/* Queue cards */}
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

      {/* Job list */}
      {selectedQueue && <JobList queueName={selectedQueue} />}
    </div>
  );
}
