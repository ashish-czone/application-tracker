import type { TaskPriority, TaskStatus } from './types';

const STATUS_STYLES: Record<TaskStatus, string> = {
  todo: 'bg-muted text-muted-foreground border-rule',
  in_progress: 'bg-authority-soft text-authority border-authority/30',
  done: 'bg-filed-soft text-filed border-filed/30',
  blocked: 'bg-destructive/10 text-destructive border-destructive/30',
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
  blocked: 'Blocked',
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  urgent: 'bg-destructive text-destructive-foreground',
  high: 'bg-due-soon-soft text-due-soon border border-due-soon/30',
  medium: 'bg-muted text-muted-foreground border border-rule',
  low: 'bg-transparent text-ink-muted border border-rule',
};

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-eyebrow ${PRIORITY_STYLES[priority]}`}
    >
      {priority}
    </span>
  );
}
