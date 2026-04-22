import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckSquare } from 'lucide-react';
import type { PaginatedResponse } from '@packages/common';
import { cn, Skeleton } from '@packages/ui';
import { usePlatformAPI } from '@packages/platform-ui';
import { useAuth } from '@packages/auth-ui';
import { tasksRoutes, type Task } from '@packages/tasks-contract';

const OPEN_STATUSES: ReadonlyArray<Task['status']> = [
  'pending',
  'in_progress',
  'blocked',
];

const PRIORITY_TONE: Record<Task['priority'], string> = {
  urgent: 'text-signal',
  high: 'text-due-soon',
  medium: 'text-ink-soft',
  low: 'text-ink-muted',
};

function formatDue(dueDate: string | null | undefined): {
  label: string;
  tone: 'overdue' | 'today' | 'soon' | 'future' | 'unscheduled';
} {
  if (!dueDate) return { label: 'No due date', tone: 'unscheduled' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, tone: 'overdue' };
  if (days === 0) return { label: 'Due today', tone: 'today' };
  if (days <= 7) return { label: `In ${days}d`, tone: 'soon' };
  return {
    label: due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    tone: 'future',
  };
}

const DUE_TONE_CLASS: Record<ReturnType<typeof formatDue>['tone'], string> = {
  overdue: 'text-signal',
  today: 'text-due-soon',
  soon: 'text-ink-soft',
  future: 'text-ink-soft',
  unscheduled: 'text-ink-muted',
};

export function MyTasksWidget() {
  const { user } = useAuth();
  const api = usePlatformAPI();
  const userId = user?.userId;

  const { data, isLoading, isError } = useQuery<PaginatedResponse<Task>>({
    queryKey: ['tasks', 'my-tasks', userId],
    enabled: !!userId,
    queryFn: () => {
      const filters = JSON.stringify([
        { field: 'assigneeId', operator: 'eq', value: userId },
      ]);
      const qs = new URLSearchParams({
        limit: '20',
        sort: 'dueDate',
        order: 'asc',
        filters,
      });
      return api.get<PaginatedResponse<Task>>(`${tasksRoutes.list}?${qs.toString()}`);
    },
  });

  const tasks = useMemo(() => {
    const all = data?.data ?? [];
    return all
      .filter((t) => OPEN_STATUSES.includes(t.status))
      .slice(0, 5);
  }, [data]);

  if (isLoading || !userId) {
    return (
      <ul className="divide-y divide-rule">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i} className="flex items-center gap-3 px-5 py-3">
            <Skeleton className="h-4 w-4 rounded-sm" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-2 w-1/3" />
            </div>
          </li>
        ))}
      </ul>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center px-5 py-10 text-center">
        <p className="text-sm text-ink-soft">Could not load your tasks.</p>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-5 py-10 text-center">
        <CheckSquare className="w-6 h-6 text-ink-muted mb-2" strokeWidth={1.5} />
        <p className="font-serif italic text-ink-soft">
          Nothing on your plate right now.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-rule">
      {tasks.map((task) => {
        const due = formatDue(task.dueDate);
        return (
          <li key={task.id} className="flex items-center gap-3 px-5 py-3">
            <CheckSquare
              className={cn('w-4 h-4 shrink-0', PRIORITY_TONE[task.priority])}
              strokeWidth={2}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-ink truncate">{task.title}</p>
              <p
                className={cn(
                  'mt-0.5 text-[10px] uppercase tracking-eyebrow font-sans font-medium',
                  DUE_TONE_CLASS[due.tone],
                )}
              >
                {due.label}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
