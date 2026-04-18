// Services
export { createAuthApi, type AuthApi } from './services';
export { createAuthenticatedApi } from './createAuthenticatedApi';
export { tokenStore } from './tokenStore';
export { authEvents, SESSION_EXPIRED_EVENT } from './authEvents';

// Hooks
export { useAuth, AUTH_QUERY_KEY } from './hooks/useAuth';
export { useLogin } from './hooks/useLogin';
export { useRegister } from './hooks/useRegister';
export { useLogout } from './hooks/useLogout';
export { useForgotPassword } from './hooks/useForgotPassword';
export { useResetPassword } from './hooks/useResetPassword';
export { useOAuthProviders, OAUTH_PROVIDERS_QUERY_KEY } from './hooks/useOAuthProviders';
export { useOAuthLogin } from './hooks/useOAuthLogin';

// Components
export { AuthGuard } from './components/AuthGuard';
export { AuthLayout } from './components/AuthLayout';
export { Can } from './components/Can';
export { Forbidden } from './components/Forbidden';
export { PermissionGuard } from './components/PermissionGuard';
export { LoginForm } from './components/LoginForm';
export { RegisterForm } from './components/RegisterForm';
export { ForgotPasswordForm } from './components/ForgotPasswordForm';
export { ResetPasswordForm } from './components/ResetPasswordForm';
export { SessionExpiredModal } from './components/SessionExpiredModal';
export { OAuthButtons } from './components/OAuthButtons';

// Types
export type {
  LoginRequest,
  RegisterRequest,
  RefreshRequest,
  LogoutRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  ChangePasswordRequest,
  AuthTokensResponse,
  RefreshTokensResponse,
  MessageResponse,
  ScopedPermissions,
  BooleanPermissions,
  JwtPayload,
  AuthUser,
  UserProfile,
  UpdateProfileRequest,
  OAuthProviderInfo,
  OAuthLoginRequest,
} from './types';
