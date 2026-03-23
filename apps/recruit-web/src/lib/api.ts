import { tokenStore } from '../shared/auth/services/tokenStore';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

// Session expiry event — SessionExpiredModal listens to this
export const authEvents = new EventTarget();
export const SESSION_EXPIRED_EVENT = 'session-expired';

// Mutex to prevent multiple concurrent refresh attempts
let refreshPromise: Promise<boolean> | null = null;

async function attemptRefresh(): Promise<boolean> {
  const refreshToken = tokenStore.getRefreshToken();
  if (!refreshToken) return false;

  try {
    // Direct fetch to avoid recursion through the interceptor
    const res = await fetch(`${API_URL}/auth/client/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) return false;

    const data = await res.json();
    tokenStore.setTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body) headers['Content-Type'] = 'application/json';

  const accessToken = tokenStore.getAccessToken();
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // 401 with an existing token → attempt silent refresh
  if (res.status === 401 && accessToken) {
    if (!refreshPromise) {
      refreshPromise = attemptRefresh().finally(() => {
        refreshPromise = null;
      });
    }
    const refreshed = await refreshPromise;

    if (refreshed) {
      // Retry the original request with the new token
      const retryHeaders: Record<string, string> = {};
      if (body) retryHeaders['Content-Type'] = 'application/json';
      const newToken = tokenStore.getAccessToken();
      if (newToken) retryHeaders['Authorization'] = `Bearer ${newToken}`;

      const retryRes = await fetch(`${API_URL}${path}`, {
        method,
        headers: retryHeaders,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!retryRes.ok) {
        const errorBody = await retryRes.json().catch(() => null);
        const error = new Error(errorBody?.message || `API error: ${retryRes.status}`);
        (error as any).status = retryRes.status;
        (error as any).body = errorBody;
        throw error;
      }

      if (retryRes.status === 204) return undefined as T;
      return retryRes.json();
    }

    // Refresh failed — session expired
    tokenStore.clearTokens();
    authEvents.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    throw new Error('Session expired');
  }

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    const error = new Error(errorBody?.message || `API error: ${res.status}`);
    (error as any).status = res.status;
    (error as any).body = errorBody;
    throw error;
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text);
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};
