// Module
export { AuthModule } from './auth.module';

// Core services
export { AuthService } from './services/auth.service';

// Adapters
export type { AuthAdapter, AuthAdapterResult } from './adapters/auth-adapter.interface';
export { AuthAdapterRegistry } from './adapters/auth-adapter-registry';

// Guards & decorators
export { AuthGuard } from './guards/auth.guard';
export { Public } from './decorators/public.decorator';
export { CurrentUser } from './decorators/current-user.decorator';

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
} from './events/types';
export type {
  UserPayload,
  PasswordResetRequestedPayload,
  PasswordResetCompletedPayload,
  UserRegisteredEvent,
  UserLoggedInEvent,
  PasswordResetRequestedEvent,
  PasswordResetCompletedEvent,
  PasswordChangedEvent,
} from './events/types';
