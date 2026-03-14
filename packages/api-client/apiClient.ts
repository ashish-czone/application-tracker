import { tokenStore } from './tokenStore';
import { ApiError, type ApiClientConfig } from './types';

export function createApiClient(config: ApiClientConfig) {
  let refreshPromise: Promise<boolean> | null = null;

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const hadToken = !!tokenStore.getToken();
    const response = await doFetch(method, path, body);

    if (response.ok) {
      if (response.status === 204) return undefined as T;
      return response.json() as Promise<T>;
    }

    if (response.status === 401) {
      const refreshed = await tryRefresh();
      if (refreshed) {
        const retryResponse = await doFetch(method, path, body);
        if (retryResponse.ok) {
          if (retryResponse.status === 204) return undefined as T;
          return retryResponse.json() as Promise<T>;
        }
        throw await buildError(retryResponse);
      }
      // Only fire session expired when user had an active session
      // (not for unauthenticated visitors who never logged in)
      if (hadToken) {
        config.onSessionExpired();
      }
      throw await buildError(response);
    }

    throw await buildError(response);
  }

  function doFetch(method: string, path: string, body?: unknown): Promise<Response> {
    const url = `${config.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const token = tokenStore.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include',
    });
  }

  async function tryRefresh(): Promise<boolean> {
    // Queue concurrent refresh attempts behind a single request
    if (refreshPromise) {
      return refreshPromise;
    }

    refreshPromise = (async () => {
      try {
        const refreshPath = config.refreshPath ?? '/users/auth/refresh';
        const response = await fetch(`${config.baseUrl}${refreshPath}`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) return false;
        const data = (await response.json()) as { accessToken?: string };
        if (data.accessToken) {
          tokenStore.setToken(data.accessToken);
          return true;
        }
        return false;
      } catch {
        return false;
      } finally {
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  }

  async function buildError(response: Response): Promise<ApiError> {
    try {
      const data = (await response.json()) as { message?: string; details?: unknown };
      return new ApiError(
        response.status,
        data.message || response.statusText,
        data.details,
      );
    } catch {
      return new ApiError(response.status, response.statusText);
    }
  }

  return {
    get: <T>(path: string) => request<T>('GET', path),
    post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
    put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
    patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
    delete: <T>(path: string) => request<T>('DELETE', path),
  };
}
