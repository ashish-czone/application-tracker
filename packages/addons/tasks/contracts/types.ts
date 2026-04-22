import type {
  EntityRow,
  EntityCreateInput,
  EntityUpdateInput,
  BaseEntityRow,
  SoftDeletableRow,
} from '@packages/entity-engine-contract';
import type { TasksFieldMap } from './fields';

/**
 * Task workflow states. Must stay in sync with `status.workflow.states`
 * in `./fields.ts` — they're declared side by side so the link is visible
 * when editing.
 */
export type TaskStatus = 'pending' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';

/**
 * Task priority values. Must stay in sync with `priority.options` in
 * `./fields.ts`.
 */
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

type RawRow = EntityRow<TasksFieldMap>;

/**
 * Task row as returned by GET /tasks and GET /tasks/:id. Picklist and
 * workflow fields are narrowed from `string` to their literal unions.
 * `status` and `priority` are non-null on the row (DB defaults guarantee
 * a value even when the client omits them on create).
 */
export type Task = Omit<RawRow, 'status' | 'priority'> & {
  status: TaskStatus;
  priority: TaskPriority;
} & BaseEntityRow & SoftDeletableRow;

type RawCreateInput = EntityCreateInput<TasksFieldMap>;

/**
 * Payload accepted by POST /tasks. Picklist narrows to TaskPriority.
 * `status` is system-managed and absent.
 */
export type TaskCreateInput = Omit<RawCreateInput, 'priority'> & {
  priority?: TaskPriority | null;
};

export type TaskUpdateInput = Partial<TaskCreateInput>;

/**
 * Payload for POST /tasks/:id/transition — triggers a workflow state
 * change on the `status` field.
 */
export interface TaskTransitionInput {
  fieldKey: 'status';
  to: TaskStatus;
  reason?: string;
  comment?: string;
}
