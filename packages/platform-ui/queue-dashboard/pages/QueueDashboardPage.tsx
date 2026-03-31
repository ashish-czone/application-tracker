import { useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Trash2,
  Inbox,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Mail,
  MessageCircle,
  Clock,
  Activity,
  ChevronLeft,
} from 'lucide-react';
import { cn, Button } from '@packages/ui';
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

const STATUS_TABS: { label: string; value: JobStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Waiting', value: 'waiting' },
  { label: 'Active', value: 'active' },
  { label: 'Completed', value: 'completed' },
  { label: 'Failed', value: 'failed' },
  { label: 'Delayed', value: 'delayed' },
];

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

// --- Helpers ---

function formatRelativeTime(ts: number | null): string {
  if (!ts) return '—';
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function formatTimestamp(ts: number | null): string {
  if (!ts) return '—';
  const d = new Date(ts);
  const now = new Date();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  if (d.toDateString() === now.toDateString()) return time;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`;
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
      {/* Header */}
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

      {/* Status bar */}
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

      {/* Counts */}
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

      {/* Footer */}
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

// --- Job Row ---

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
        className={cn(
          'group cursor-pointer text-[13px] transition-colors',
          isExpanded ? 'bg-muted/40' : 'hover:bg-muted/30',
        )}
        onClick={onToggle}
      >
        <td className="pl-4 pr-1 py-3 w-8">
          <ChevronRight
            className={cn(
              'h-3.5 w-3.5 text-muted-foreground/60 transition-transform duration-200',
              isExpanded && 'rotate-90',
            )}
          />
        </td>
        <td className="px-3 py-3">
          <span className="font-mono text-xs text-muted-foreground">{job.id}</span>
        </td>
        <td className="px-3 py-3">
          <span className={cn(
            'inline-flex items-center gap-1.5 rounded-md ring-1 ring-inset px-2 py-0.5 text-[11px] font-medium',
            STATUS_BADGE[job.status] || 'bg-muted text-muted-foreground ring-border',
          )}>
            <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[job.status] || 'bg-muted-foreground')} />
            {job.status}
          </span>
        </td>
        <td className="px-3 py-3">
          <span className="text-[13px] text-muted-foreground" title={job.timestamp ? new Date(job.timestamp).toISOString() : ''}>
            {formatRelativeTime(job.timestamp)}
          </span>
        </td>
        <td className="px-3 py-3">
          <span className="text-[13px] text-muted-foreground tabular-nums">
            {formatDuration(job.processedOn, job.finishedOn)}
          </span>
        </td>
        <td className="px-3 py-3">
          <span className="text-[13px] text-muted-foreground tabular-nums">{job.attemptsMade}</span>
        </td>
        <td className="px-3 py-3 max-w-[220px]">
          {job.failedReason ? (
            <span className="text-[12px] text-red-600/80 truncate block" title={job.failedReason}>
              {job.failedReason}
            </span>
          ) : (
            <span className="text-muted-foreground/40">—</span>
          )}
        </td>
        <td className="px-3 py-3 w-20">
          <div
            className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            {job.status === 'failed' && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-primary"
                onClick={() => retryMutation.mutate({ queueName, jobId: job.id })}
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
              onClick={() => removeMutation.mutate({ queueName, jobId: job.id })}
              disabled={removeMutation.isPending}
              title="Remove job"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={8} className="bg-slate-950 px-0 py-0">
            <div className="px-6 py-4 space-y-3 text-[12px] font-mono">
              {job.failedReason && (
                <div>
                  <div className="text-red-400/70 text-[10px] uppercase tracking-wider mb-1">Error</div>
                  <div className="text-red-300">{job.failedReason}</div>
                </div>
              )}
              {job.stacktrace.length > 0 && (
                <div>
                  <div className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">Stacktrace</div>
                  <pre className="text-slate-300 text-[11px] leading-relaxed overflow-x-auto max-h-48 scrollbar-thin">
                    {job.stacktrace.join('\n')}
                  </pre>
                </div>
              )}
              <div>
                <div className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">Payload</div>
                <pre className="text-emerald-300/80 text-[11px] leading-relaxed overflow-x-auto max-h-48">
                  {JSON.stringify(job.data, null, 2)}
                </pre>
              </div>
              {job.returnvalue != null && (
                <div>
                  <div className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">Return Value</div>
                  <pre className="text-blue-300/80 text-[11px] leading-relaxed overflow-x-auto max-h-48">
                    {JSON.stringify(job.returnvalue, null, 2)}
                  </pre>
                </div>
              )}
              <div className="flex gap-6 pt-2 border-t border-slate-800 text-[11px] text-slate-500">
                <span>Created: <span className="text-slate-400">{formatTimestamp(job.timestamp)}</span></span>
                <span>Started: <span className="text-slate-400">{formatTimestamp(job.processedOn)}</span></span>
                <span>Finished: <span className="text-slate-400">{formatTimestamp(job.finishedOn)}</span></span>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// --- Job List ---

function JobList({ queueName, onBack }: { queueName: string; onBack: () => void }) {
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
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setStatusFilter(tab.value); setPage(0); setExpandedId(null); }}
            className={cn(
              'relative px-3 py-2 text-xs font-medium transition-colors',
              statusFilter === tab.value
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span className="flex items-center gap-1.5">
              {tab.value !== 'all' && (
                <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[tab.value])} />
              )}
              {tab.label}
            </span>
            {statusFilter === tab.value && (
              <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden bg-card">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="pl-4 pr-1 py-2.5 w-8" />
              <th className="px-3 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Job ID</th>
              <th className="px-3 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="px-3 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Created</th>
              <th className="px-3 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Duration</th>
              <th className="px-3 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Attempts</th>
              <th className="px-3 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Error</th>
              <th className="px-3 py-2.5 w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={8} className="px-4 py-3.5">
                    <div className="flex gap-4">
                      <div className="h-3.5 w-8 animate-pulse rounded bg-muted" />
                      <div className="h-3.5 w-16 animate-pulse rounded bg-muted" />
                      <div className="h-3.5 w-14 animate-pulse rounded bg-muted" />
                      <div className="h-3.5 w-20 animate-pulse rounded bg-muted" />
                      <div className="h-3.5 flex-1 animate-pulse rounded bg-muted" />
                    </div>
                  </td>
                </tr>
              ))
            ) : jobs.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12">
                  <div className="flex flex-col items-center text-center">
                    <Inbox className="h-8 w-8 text-muted-foreground/40 mb-2" />
                    <span className="text-sm text-muted-foreground">No jobs found</span>
                    <span className="text-xs text-muted-foreground/60 mt-0.5">
                      {statusFilter !== 'all' ? `No ${statusFilter} jobs in this queue` : 'This queue is empty'}
                    </span>
                  </div>
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
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-muted-foreground tabular-nums">
            {(page * limit + 1).toLocaleString()}–{Math.min((page + 1) * limit, total).toLocaleString()} of {total.toLocaleString()}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-0.5 px-2">
              {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                const pageNum = totalPages <= 5 ? i : Math.max(0, Math.min(page - 2, totalPages - 5)) + i;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={cn(
                      'h-8 w-8 rounded-md text-xs font-medium transition-colors',
                      page === pageNum
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted',
                    )}
                  >
                    {pageNum + 1}
                  </button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              <ChevronRight className="h-4 w-4" />
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
      <div className="max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-5 w-32 animate-pulse rounded bg-muted mb-2" />
            <div className="h-3.5 w-56 animate-pulse rounded bg-muted" />
          </div>
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
      {/* Header */}
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
      {selectedQueue && (
        <JobList
          queueName={selectedQueue}
          onBack={() => setSelectedQueue(null)}
        />
      )}
    </div>
  );
}
