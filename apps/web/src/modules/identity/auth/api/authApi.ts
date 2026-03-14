import { api } from '../../../../lib/api';
import { tokenStore } from '@packages/api-client';
import type { AuthIdentity } from '../../types';

interface TokenResponse {
  accessToken: string;
}

export function login(data: { email: string; password: string }): Promise<TokenResponse> {
  return api.post<TokenResponse>('/auth/login', data).then((res) => {
    tokenStore.setToken(res.accessToken);
    return res;
  });
}

export function register(data: { email: string; password: string }): Promise<TokenResponse> {
  return api.post<TokenResponse>('/auth/register', data).then((res) => {
    tokenStore.setToken(res.accessToken);
    return res;
  });
}

export function logout(): Promise<void> {
  return api.post<void>('/auth/logout').then(() => {
    tokenStore.clearToken();
  });
}

export function forgotPassword(data: { email: string }): Promise<void> {
  return api.post<void>('/auth/forgot-password', data);
}

export function resetPassword(data: { token: string; password: string }): Promise<void> {
  return api.post<void>('/auth/reset-password', data);
}

export function getMe(): Promise<AuthIdentity> {
  return api.get<AuthIdentity>('/auth/me');
}
