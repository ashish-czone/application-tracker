import type { DomainEvent } from '@packages/events';

/**
 * Emitted when a user's `deletedAt` is stamped via the entity-engine
 * soft-delete path (`DELETE /users/:id`). Per Q32 in
 * `domains/compliance/todos.md`, a deactivated user is authoritatively
 * identified by `users.deletedAt IS NOT NULL` — consumers that need to
 * react to deactivation (task assignee null-out, org-unit membership
 * removal, etc.) listen for this event.
 *
 * The event name is the same dynamic string the entity-engine emits
 * (`users.Deleted`). Exposing a semantic constant here lets consumers
 * subscribe with `@OnEvent(USERS_USER_DEACTIVATED)` instead of a
 * stringly-typed pattern, and documents the intent at the listener site.
 *
 * Handlers must be idempotent — re-running on the same event is a no-op
 * (see `event-conventions.md`).
 */
export const USERS_USER_DEACTIVATED = 'users.Deleted' as const;

export interface UserDeactivatedPayload {
  /** Snapshot of the user row before soft-delete. */
  before: Record<string, unknown>;
  [key: string]: unknown;
}

declare module '@packages/events' {
  interface EventPayloadMap {
    [USERS_USER_DEACTIVATED]: UserDeactivatedPayload;
  }
}

export interface UserDeactivatedEvent extends DomainEvent {
  eventName: typeof USERS_USER_DEACTIVATED;
  entityType: 'users';
  payload: UserDeactivatedPayload;
}
