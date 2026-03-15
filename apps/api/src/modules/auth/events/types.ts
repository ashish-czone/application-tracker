import type { DomainEvent } from '@packages/events';

export const AUTH_USER_REGISTERED = 'auth.UserRegistered' as const;
export const AUTH_USER_LOGGED_IN = 'auth.UserLoggedIn' as const;
export const AUTH_PASSWORD_RESET_REQUESTED = 'auth.PasswordResetRequested' as const;
export const AUTH_PASSWORD_RESET_COMPLETED = 'auth.PasswordResetCompleted' as const;
export const AUTH_PASSWORD_CHANGED = 'auth.PasswordChanged' as const;

interface UserPayload extends Record<string, unknown> {
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  userType: string;
}

export interface UserRegisteredEvent extends DomainEvent {
  eventName: typeof AUTH_USER_REGISTERED;
  entityType: 'users';
  payload: UserPayload;
}

export interface UserLoggedInEvent extends DomainEvent {
  eventName: typeof AUTH_USER_LOGGED_IN;
  entityType: 'users';
  payload: UserPayload;
}

export interface PasswordResetRequestedEvent extends DomainEvent {
  eventName: typeof AUTH_PASSWORD_RESET_REQUESTED;
  entityType: 'users';
  payload: {
    identifier: string;
    token: string;
    expiresAt: string;
    userType: string;
  };
}

export interface PasswordResetCompletedEvent extends DomainEvent {
  eventName: typeof AUTH_PASSWORD_RESET_COMPLETED;
  entityType: 'users';
  payload: {
    userType: string;
  };
}

export interface PasswordChangedEvent extends DomainEvent {
  eventName: typeof AUTH_PASSWORD_CHANGED;
  entityType: 'users';
  payload: UserPayload;
}
