import type { ColumnRendererRegistration } from '@packages/entity-engine-ui';
import { useTransitionTaskFromMyList } from '../api/hooks';
import { TaskStatusCell } from './TaskStatusCell';
import type { TaskStatus } from '../types';

/**
 * Cell renderer for the auto-generated tasks list page. Replaces the default
 * pipeline progress visual with a clickable status badge whose dropdown
 * triggers a workflow transition. Registered with WebShell via
 * `extraColumnRenderers={{ TaskStatusInline }}` and selected by setting
 * `cellRenderer: 'TaskStatusInline'` on the tasks `status` field UI config.
 */
function TaskStatusInlineCell({ value, row }: { value: unknown; row: Record<string, unknown> }) {
  const transition = useTransitionTaskFromMyList();
  const id = row.id as string;
  const status = (value ?? 'todo') as TaskStatus;
  return (
    <TaskStatusCell
      status={status}
      onChange={(next) => transition.mutate({ id, to: next })}
      disabled={transition.isPending}
    />
  );
}

export const taskStatusInlineRenderer: ColumnRendererRegistration = {
  component: TaskStatusInlineCell,
};
