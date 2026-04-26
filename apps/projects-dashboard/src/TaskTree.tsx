import { CheckCircle2, Circle, CircleDashed, MinusCircle } from 'lucide-react';
import type { Task, TaskStatus } from './types';
import { PriorityBadge, StatusBadge } from './badges';

const STATUS_ICON: Record<TaskStatus, React.ComponentType<{ className?: string }>> = {
  todo: Circle,
  in_progress: CircleDashed,
  done: CheckCircle2,
  blocked: MinusCircle,
};

const STATUS_ICON_CLASS: Record<TaskStatus, string> = {
  todo: 'text-muted-foreground',
  in_progress: 'text-authority',
  done: 'text-filed',
  blocked: 'text-destructive',
};

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

interface TaskNodeProps {
  task: Task;
  children: Task[];
  childrenByParent: Map<string | null, Task[]>;
  depth: number;
}

function TaskNode({ task, children, childrenByParent, depth }: TaskNodeProps) {
  const Icon = STATUS_ICON[task.status];
  const isFeature = task.type === 'feature';
  const completedAt = formatDate(task.completedAt);

  const featureStats =
    isFeature && children.length > 0
      ? {
          total: children.length,
          done: children.filter((c) => c.status === 'done').length,
        }
      : null;

  return (
    <div>
      <div
        className={`flex items-start gap-3 rounded-md border-l-2 px-3 py-2.5 transition-colors hover:bg-muted/40 ${
          isFeature
            ? 'mt-3 border-authority bg-paper-raised shadow-ink-hair'
            : depth === 1
              ? 'border-rule'
              : 'border-rule/50'
        }`}
        style={{ marginLeft: depth * 20 }}
      >
        <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${STATUS_ICON_CLASS[task.status]}`} />

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[10px] font-mono text-ink-muted">{task.id}</span>
            <span
              className={`${isFeature ? 'text-base font-semibold text-ink' : 'text-sm text-foreground'}`}
            >
              {task.title}
            </span>
            <PriorityBadge priority={task.priority} />
            <StatusBadge status={task.status} />
            {featureStats && (
              <span className="text-xs text-muted-foreground">
                {featureStats.done}/{featureStats.total} tasks done
              </span>
            )}
            {completedAt && (
              <span className="text-xs text-filed">completed {completedAt}</span>
            )}
          </div>

          {task.acceptanceCriteria && (
            <p className="mt-1 text-xs text-ink-soft">
              <span className="font-semibold uppercase tracking-eyebrow text-ink-muted">
                AC:
              </span>{' '}
              {task.acceptanceCriteria}
            </p>
          )}

          {task.notes && (
            <p className="mt-1 text-xs text-muted-foreground italic">{task.notes}</p>
          )}
        </div>
      </div>

      {children.map((child) => (
        <TaskNode
          key={child.id}
          task={child}
          children={childrenByParent.get(child.id) ?? []}
          childrenByParent={childrenByParent}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

export function TaskTree({ tasks }: { tasks: Task[] }) {
  const childrenByParent = new Map<string | null, Task[]>();
  for (const t of tasks) {
    const arr = childrenByParent.get(t.parentId) ?? [];
    arr.push(t);
    childrenByParent.set(t.parentId, arr);
  }

  const features = childrenByParent.get(null) ?? [];

  if (features.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        No tasks yet. Add features and tasks to{' '}
        <code className="font-mono text-xs">.projects/&lt;slug&gt;.json</code>.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {features.map((f) => (
        <TaskNode
          key={f.id}
          task={f}
          children={childrenByParent.get(f.id) ?? []}
          childrenByParent={childrenByParent}
          depth={0}
        />
      ))}
    </div>
  );
}
