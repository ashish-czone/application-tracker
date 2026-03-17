import { api } from '../../../lib/api';
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
} from '../types';

const AUTH_BASE = '/auth/client';

export function login(data: LoginRequest): Promise<AuthTokensResponse> {
  return api.post<AuthTokensResponse>(`${AUTH_BASE}/login`, data);
}

export function register(data: RegisterRequest): Promise<AuthTokensResponse> {
  return api.post<AuthTokensResponse>(`${AUTH_BASE}/register`, data);
}

export function refreshTokens(data: RefreshRequest): Promise<RefreshTokensResponse> {
  return api.post<RefreshTokensResponse>(`${AUTH_BASE}/refresh`, data);
}

export function logout(data: LogoutRequest): Promise<void> {
  return api.post<void>(`${AUTH_BASE}/logout`, data);
}

export function logoutAll(): Promise<void> {
  return api.post<void>(`${AUTH_BASE}/logout-all`);
}

export function forgotPassword(data: ForgotPasswordRequest): Promise<MessageResponse> {
  return api.post<MessageResponse>(`${AUTH_BASE}/forgot-password`, data);
}

export function resetPassword(data: ResetPasswordRequest): Promise<MessageResponse> {
  return api.post<MessageResponse>(`${AUTH_BASE}/reset-password`, data);
}

export function changePassword(data: ChangePasswordRequest): Promise<MessageResponse> {
  return api.post<MessageResponse>(`${AUTH_BASE}/change-password`, data);
}
