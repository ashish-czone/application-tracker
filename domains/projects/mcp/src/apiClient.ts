import type { ServerConfig } from './config';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly body: string,
  ) {
    super(`API ${status} ${statusText}: ${truncate(body, 500)}`);
    this.name = 'ApiError';
  }
}

export interface ApiClient {
  get<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
  patch<T>(path: string, body: unknown): Promise<T>;
}

export function createApiClient(
  config: ServerConfig,
  fetchImpl: typeof fetch = fetch,
): ApiClient {
  const headers = (): Record<string, string> => ({
    Authorization: `Bearer ${config.apiToken}`,
    Accept: 'application/json',
  });

  const buildUrl = (
    path: string,
    query?: Record<string, string | number | undefined>,
  ): string => {
    const url = new URL(path.startsWith('/') ? path.slice(1) : path, `${config.apiUrl}/`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.set(key, String(value));
        }
      }
    }
    return url.toString();
  };

  const send = async <T>(method: string, url: string, body?: unknown): Promise<T> => {
    const init: RequestInit = { method, headers: headers() };
    if (body !== undefined) {
      init.headers = { ...init.headers, 'Content-Type': 'application/json' };
      init.body = JSON.stringify(body);
    }
    const response = await fetchImpl(url, init);
    const text = await response.text();
    if (!response.ok) {
      throw new ApiError(response.status, response.statusText, text);
    }
    return text ? (JSON.parse(text) as T) : (undefined as T);
  };

  return {
    get: (path, query) => send('GET', buildUrl(path, query)),
    post: (path, body) => send('POST', buildUrl(path), body),
    patch: (path, body) => send('PATCH', buildUrl(path), body),
  };
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}
