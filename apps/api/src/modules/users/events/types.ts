import type { DomainEvent } from '@packages/events';

export const USERS_USER_CREATED = 'users.UserCreated' as const;
export const USERS_USER_UPDATED = 'users.UserUpdated' as const;
export const USERS_USER_DELETED = 'users.UserDeleted' as const;

// --- Payload types ---

export interface UserCreatedPayload {
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  userTypes: string[];
  [key: string]: unknown;
}

export interface UserUpdatedPayload {
  changes: string[];
  [key: string]: unknown;
}

export interface UserDeletedPayload {
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  [key: string]: unknown;
}

// --- Augment global EventPayloadMap for compile-time safety ---

declare module '@packages/events' {
  interface EventPayloadMap {
    [USERS_USER_CREATED]: UserCreatedPayload;
    [USERS_USER_UPDATED]: UserUpdatedPayload;
    [USERS_USER_DELETED]: UserDeletedPayload;
  }
}

// --- Full event interfaces (for consumers/listeners) ---

export interface UserCreatedEvent extends DomainEvent {
  eventName: typeof USERS_USER_CREATED;
  entityType: 'users';
  payload: UserCreatedPayload;
}

export interface UserUpdatedEvent extends DomainEvent {
  eventName: typeof USERS_USER_UPDATED;
  entityType: 'users';
  payload: UserUpdatedPayload;
}

export interface UserDeletedEvent extends DomainEvent {
  eventName: typeof USERS_USER_DELETED;
  entityType: 'users';
  payload: UserDeletedPayload;
}
