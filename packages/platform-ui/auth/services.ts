import type { ApiFn } from '../PlatformUIProvider';
import type {
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
  UserProfile,
  UpdateProfileRequest,
} from './types';

const AUTH_BASE = '/auth/client';

export function createAuthApi(api: ApiFn) {
  return {
    login(data: LoginRequest): Promise<AuthTokensResponse> {
      return api.post<AuthTokensResponse>(`${AUTH_BASE}/login`, data);
    },

    register(data: RegisterRequest): Promise<AuthTokensResponse> {
      return api.post<AuthTokensResponse>(`${AUTH_BASE}/register`, data);
    },

    refreshTokens(data: RefreshRequest): Promise<RefreshTokensResponse> {
      return api.post<RefreshTokensResponse>(`${AUTH_BASE}/refresh`, data);
    },

    logout(data: LogoutRequest): Promise<void> {
      return api.post<void>(`${AUTH_BASE}/logout`, data);
    },

    logoutAll(): Promise<void> {
      return api.post<void>(`${AUTH_BASE}/logout-all`);
    },

    forgotPassword(data: ForgotPasswordRequest): Promise<MessageResponse> {
      return api.post<MessageResponse>(`${AUTH_BASE}/forgot-password`, data);
    },

    resetPassword(data: ResetPasswordRequest): Promise<MessageResponse> {
      return api.post<MessageResponse>(`${AUTH_BASE}/reset-password`, data);
    },

    changePassword(data: ChangePasswordRequest): Promise<MessageResponse> {
      return api.post<MessageResponse>(`${AUTH_BASE}/change-password`, data);
    },

    getProfile(): Promise<UserProfile> {
      return api.get<UserProfile>(`${AUTH_BASE}/me`);
    },

    updateProfile(data: UpdateProfileRequest): Promise<UserProfile> {
      return api.patch<UserProfile>(`${AUTH_BASE}/me`, data);
    },
  };
}

export type AuthApi = ReturnType<typeof createAuthApi>;
