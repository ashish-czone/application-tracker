import type { DomainEvent } from '@packages/events';

export const TASKS_TASK_CREATED = 'tasks.TaskCreated' as const;
export const TASKS_TASK_UPDATED = 'tasks.TaskUpdated' as const;
export const TASKS_TASK_DELETED = 'tasks.TaskDeleted' as const;

// --- Payload types ---

export interface TaskCreatedPayload {
  title: string;
  status: string;
  priority: string;
  assigneeId: string | null;
  [key: string]: unknown;
}

export interface TaskUpdatedPayload {
  changes: string[];
  [key: string]: unknown;
}

export interface TaskDeletedPayload {
  title: string;
  [key: string]: unknown;
}

// --- Augment global EventPayloadMap for compile-time safety ---

declare module '@packages/events' {
  interface EventPayloadMap {
    [TASKS_TASK_CREATED]: TaskCreatedPayload;
    [TASKS_TASK_UPDATED]: TaskUpdatedPayload;
    [TASKS_TASK_DELETED]: TaskDeletedPayload;
  }
}

// --- Full event interfaces (for consumers/listeners) ---

export interface TaskCreatedEvent extends DomainEvent {
  eventName: typeof TASKS_TASK_CREATED;
  entityType: 'tasks';
  payload: TaskCreatedPayload;
}

export interface TaskUpdatedEvent extends DomainEvent {
  eventName: typeof TASKS_TASK_UPDATED;
  entityType: 'tasks';
  payload: TaskUpdatedPayload;
}

export interface TaskDeletedEvent extends DomainEvent {
  eventName: typeof TASKS_TASK_DELETED;
  entityType: 'tasks';
  payload: TaskDeletedPayload;
}
