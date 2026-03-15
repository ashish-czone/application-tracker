import type { DomainEvent } from '@packages/events';

export const AUTH_USER_REGISTERED = 'auth.UserRegistered' as const;
export const AUTH_USER_LOGGED_IN = 'auth.UserLoggedIn' as const;
export const AUTH_PASSWORD_RESET_REQUESTED = 'auth.PasswordResetRequested' as const;
export const AUTH_PASSWORD_RESET_COMPLETED = 'auth.PasswordResetCompleted' as const;
export const AUTH_PASSWORD_CHANGED = 'auth.PasswordChanged' as const;
