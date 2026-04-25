// Module
export { AuthModule } from './auth.module';

// Core services
export { AuthService } from './services/auth.service';

// Adapters
export type { AuthAdapter, AuthAdapterResult } from './adapters/auth-adapter.interface';
export { AuthAdapterRegistry } from './adapters/auth-adapter-registry';

// Guards & decorators
export { AuthGuard } from './guards/auth.guard';
export { Public, CurrentUser, IS_PUBLIC_KEY } from '@packages/auth-core';

// Types
export type { Credential, AuthToken, JwtPayload, AuthModuleConfig } from './types';

// Schema
export { credentials, authTokens } from './schema';

// Event constants & types
export {
  AUTH_USER_REGISTERED,
  AUTH_USER_LOGGED_IN,
  AUTH_PASSWORD_RESET_REQUESTED,
  AUTH_PASSWORD_RESET_COMPLETED,
  AUTH_PASSWORD_CHANGED,
  AUTH_ACCOUNT_LINKED,
  AUTH_INVITATION_SENT,
  AUTH_INVITATION_ACCEPTED,
} from './events/types';
export type {
  UserPayload,
  PasswordResetRequestedPayload,
  PasswordResetCompletedPayload,
  AccountLinkedPayload,
  InvitationSentPayload,
  InvitationAcceptedPayload,
  UserRegisteredEvent,
  UserLoggedInEvent,
  PasswordResetRequestedEvent,
  PasswordResetCompletedEvent,
  PasswordChangedEvent,
  AccountLinkedEvent,
  InvitationSentEvent,
  InvitationAcceptedEvent,
} from './events/types';
