import type { DomainEvent } from '@packages/events';

export const USERS_USER_CREATED = 'users.UserCreated' as const;
export const USERS_USER_UPDATED = 'users.UserUpdated' as const;
export const USERS_USER_DELETED = 'users.UserDeleted' as const;

export interface UserCreatedEvent extends DomainEvent {
  eventName: typeof USERS_USER_CREATED;
  entityType: 'user';
  payload: {
    email: string;
    firstName: string;
    lastName: string;
    registeredSelf: boolean;
  };
}

export interface UserUpdatedEvent extends DomainEvent {
  eventName: typeof USERS_USER_UPDATED;
  entityType: 'user';
  payload: {
    updatedFields: string[];
  };
}

export interface UserDeletedEvent extends DomainEvent {
  eventName: typeof USERS_USER_DELETED;
  entityType: 'user';
  payload: {
    email: string;
  };
}
