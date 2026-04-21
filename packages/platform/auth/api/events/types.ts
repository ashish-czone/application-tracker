import type { DomainEvent } from '@packages/events';

export const AUTH_USER_REGISTERED = 'auth.UserRegistered' as const;
export const AUTH_USER_LOGGED_IN = 'auth.UserLoggedIn' as const;
export const AUTH_PASSWORD_RESET_REQUESTED = 'auth.PasswordResetRequested' as const;
export const AUTH_PASSWORD_RESET_COMPLETED = 'auth.PasswordResetCompleted' as const;
export const AUTH_PASSWORD_CHANGED = 'auth.PasswordChanged' as const;
export const AUTH_ACCOUNT_LINKED = 'auth.AccountLinked' as const;
export const AUTH_INVITATION_SENT = 'auth.InvitationSent' as const;
export const AUTH_INVITATION_ACCEPTED = 'auth.InvitationAccepted' as const;

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

export interface AccountLinkedPayload {
  provider: string;
  userType: string;
  [key: string]: unknown;
}

export interface InvitationSentPayload {
  email: string;
  firstName: string | null;
  lastName: string | null;
  userType: string;
  token: string;
  expiresAt: string;
  [key: string]: unknown;
}

export interface InvitationAcceptedPayload {
  email: string;
  userType: string;
  [key: string]: unknown;
}

// --- Augment global EventPayloadMap for compile-time safety ---

declare module '@packages/events' {
  interface EventPayloadMap {
    [AUTH_USER_REGISTERED]: UserPayload;
    [AUTH_USER_LOGGED_IN]: UserPayload;
    [AUTH_PASSWORD_RESET_REQUESTED]: PasswordResetRequestedPayload;
    [AUTH_PASSWORD_RESET_COMPLETED]: PasswordResetCompletedPayload;
    [AUTH_PASSWORD_CHANGED]: UserPayload;
    [AUTH_ACCOUNT_LINKED]: AccountLinkedPayload;
    [AUTH_INVITATION_SENT]: InvitationSentPayload;
    [AUTH_INVITATION_ACCEPTED]: InvitationAcceptedPayload;
  }
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

export interface AccountLinkedEvent extends DomainEvent {
  eventName: typeof AUTH_ACCOUNT_LINKED;
  entityType: 'users';
  payload: AccountLinkedPayload;
}

export interface InvitationSentEvent extends DomainEvent {
  eventName: typeof AUTH_INVITATION_SENT;
  entityType: 'users';
  payload: InvitationSentPayload;
}

export interface InvitationAcceptedEvent extends DomainEvent {
  eventName: typeof AUTH_INVITATION_ACCEPTED;
  entityType: 'users';
  payload: InvitationAcceptedPayload;
}
