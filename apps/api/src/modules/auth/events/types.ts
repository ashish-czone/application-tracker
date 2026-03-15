import type { DomainEvent } from '@packages/events';

export const AUTH_USER_REGISTERED = 'auth.UserRegistered' as const;
export const AUTH_USER_LOGGED_IN = 'auth.UserLoggedIn' as const;
export const AUTH_PASSWORD_RESET_REQUESTED = 'auth.PasswordResetRequested' as const;
export const AUTH_PASSWORD_RESET_COMPLETED = 'auth.PasswordResetCompleted' as const;
export const AUTH_PASSWORD_CHANGED = 'auth.PasswordChanged' as const;

// --- Payload types ---

export interface UserPayload {
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  userType: string;
  [key: string]: unknown;
}

export interface PasswordResetRequestedPayload {
  identifier: string;
  token: string;
  expiresAt: string;
  userType: string;
  [key: string]: unknown;
}

export interface PasswordResetCompletedPayload {
  userType: string;
  [key: string]: unknown;
}

// --- Type map: event name → payload ---

export interface AuthEventPayloads {
  [AUTH_USER_REGISTERED]: UserPayload;
  [AUTH_USER_LOGGED_IN]: UserPayload;
  [AUTH_PASSWORD_RESET_REQUESTED]: PasswordResetRequestedPayload;
  [AUTH_PASSWORD_RESET_COMPLETED]: PasswordResetCompletedPayload;
  [AUTH_PASSWORD_CHANGED]: UserPayload;
}

// --- Full event interfaces (for consumers/listeners) ---

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
  payload: PasswordResetRequestedPayload;
}

export interface PasswordResetCompletedEvent extends DomainEvent {
  eventName: typeof AUTH_PASSWORD_RESET_COMPLETED;
  entityType: 'users';
  payload: PasswordResetCompletedPayload;
}

export interface PasswordChangedEvent extends DomainEvent {
  eventName: typeof AUTH_PASSWORD_CHANGED;
  entityType: 'users';
  payload: UserPayload;
}
