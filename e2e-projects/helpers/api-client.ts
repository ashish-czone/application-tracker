import { readStoredTokens } from '../fixtures/auth';

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3014';
const API_BASE = `${API_URL}/api/v1`;

interface ApiOptions {
  /** Override the bearer token; defaults to the e2e-admin token written by globalSetup. */
  token?: string;
  /** Path query params; appended as ?key=value. */
  query?: Record<string, string | number | boolean | undefined>;
}

function buildUrl(path: string, query?: ApiOptions['query']): string {
  const url = new URL(API_BASE + (path.startsWith('/') ? path : `/${path}`));
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: ApiOptions = {},
): Promise<T> {
  const token = options.token ?? readStoredTokens().accessToken;
  const res = await fetch(buildUrl(path, options.query), {
    method,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `e2e api ${method} ${path} → ${res.status}: ${text.slice(0, 500)}`,
    );
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/**
 * Authenticated thin wrapper over the agency API. Used by test setup/teardown
 * to create or delete entities directly (faster than driving the UI for state setup).
 *
 * Specs should drive the UI for the behavior under test, and use these helpers only
 * for fixtures (e.g. "given a project exists, when I open its detail page...").
 */
export const apiClient = {
  get: <T = unknown>(path: string, options?: ApiOptions) => request<T>('GET', path, undefined, options),
  post: <T = unknown>(path: string, body?: unknown, options?: ApiOptions) =>
    request<T>('POST', path, body, options),
  patch: <T = unknown>(path: string, body?: unknown, options?: ApiOptions) =>
    request<T>('PATCH', path, body, options),
  put: <T = unknown>(path: string, body?: unknown, options?: ApiOptions) =>
    request<T>('PUT', path, body, options),
  delete: <T = unknown>(path: string, options?: ApiOptions) =>
    request<T>('DELETE', path, undefined, options),
};
