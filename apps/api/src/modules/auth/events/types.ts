import type { DomainEvent } from '@packages/events';

export const AUTH_USER_REGISTERED = 'auth.UserRegistered' as const;
export const AUTH_USER_LOGGED_IN = 'auth.UserLoggedIn' as const;
export const AUTH_PASSWORD_RESET_REQUESTED = 'auth.PasswordResetRequested' as const;
export const AUTH_PASSWORD_RESET_COMPLETED = 'auth.PasswordResetCompleted' as const;
export const AUTH_PASSWORD_CHANGED = 'auth.PasswordChanged' as const;

export interface UserRegisteredEvent extends DomainEvent {
  eventName: typeof AUTH_USER_REGISTERED;
  entityType: 'user';
  payload: {
    email: string;
    userType: string;
  };
}

export interface UserLoggedInEvent extends DomainEvent {
  eventName: typeof AUTH_USER_LOGGED_IN;
  entityType: 'user';
  payload: {
    userType: string;
  };
}

export interface PasswordResetRequestedEvent extends DomainEvent {
  eventName: typeof AUTH_PASSWORD_RESET_REQUESTED;
  entityType: 'user';
  payload: {
    token: string;
    expiresAt: string;
  };
}

export interface PasswordResetCompletedEvent extends DomainEvent {
  eventName: typeof AUTH_PASSWORD_RESET_COMPLETED;
  entityType: 'user';
  payload: Record<string, unknown>;
}

export interface PasswordChangedEvent extends DomainEvent {
  eventName: typeof AUTH_PASSWORD_CHANGED;
  entityType: 'user';
  payload: Record<string, unknown>;
}
