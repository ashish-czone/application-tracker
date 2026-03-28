import type { JwtPayload } from '../types';

const REFRESH_TOKEN_KEY = 'auth_refresh_token';
const USER_ID_KEY = 'auth_user_id';

// Access token is stored in-memory only (not localStorage) for security
let accessToken: string | null = null;

export const tokenStore = {
  getAccessToken(): string | null {
    return accessToken;
  },

  setAccessToken(token: string | null): void {
    accessToken = token;
  },

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },

  setRefreshToken(token: string | null): void {
    if (token) {
      localStorage.setItem(REFRESH_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  },

  setTokens(access: string, refresh: string): void {
    accessToken = access;
    localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
    // Persist userId for user-scoped localStorage keys (filters, preferences)
    try {
      const payload = JSON.parse(atob(access.split('.')[1]));
      if (payload?.userId) localStorage.setItem(USER_ID_KEY, payload.userId);
    } catch { /* ignore */ }
  },

  clearTokens(): void {
    accessToken = null;
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_ID_KEY);
  },

  /** Decode JWT payload without signature verification (client-side only). */
  decodeAccessToken(): JwtPayload | null {
    if (!accessToken) return null;
    try {
      const payloadPart = accessToken.split('.')[1];
      const decoded = JSON.parse(atob(payloadPart));
      if (decoded.exp * 1000 < Date.now()) return null;
      return decoded as JwtPayload;
    } catch {
      return null;
    }
  },

  /** Returns true if the access token is missing or expires within 30 seconds. */
  isAccessTokenExpired(): boolean {
    const payload = this.decodeAccessToken();
    if (!payload) return true;
    return payload.exp * 1000 - Date.now() < 30_000;
  },
};
