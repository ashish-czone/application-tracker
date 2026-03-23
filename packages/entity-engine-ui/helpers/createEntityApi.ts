import type { PaginatedResponse } from '@packages/common';
import type { EntityApi } from '../types';

/**
 * Creates a typed API client for a single entity.
 *
 * @param slug — entity URL slug (e.g. 'candidates')
 * @param apiFn — the app's `api` object with get/post/patch/delete methods
 */
export function createEntityApi(
  slug: string,
  apiFn: {
    get: <T>(path: string) => Promise<T>;
    post: <T>(path: string, body?: unknown) => Promise<T>;
    patch: <T>(path: string, body?: unknown) => Promise<T>;
    delete: <T>(path: string) => Promise<T>;
  },
): EntityApi {
  const basePath = `/${slug}`;

  return {
    list: (params: Record<string, unknown>) => {
      const searchParams = new URLSearchParams();

      for (const [key, value] of Object.entries(params)) {
        if (value != null && value !== '' && value !== false) {
          searchParams.set(key, String(value));
        }
      }

      // Don't send page=1 (it's the default)
      if (searchParams.get('page') === '1') searchParams.delete('page');

      const qs = searchParams.toString();
      return apiFn.get<PaginatedResponse<Record<string, unknown>>>(`${basePath}${qs ? `?${qs}` : ''}`);
    },

    get: (id: string) => apiFn.get<Record<string, unknown>>(`${basePath}/${id}`),

    create: (data: Record<string, unknown>) => apiFn.post<Record<string, unknown>>(basePath, data),

    update: (id: string, data: Record<string, unknown>) =>
      apiFn.patch<Record<string, unknown>>(`${basePath}/${id}`, data),

    delete: (id: string) => apiFn.delete<void>(`${basePath}/${id}`),

    restore: (id: string) => apiFn.post<Record<string, unknown>>(`${basePath}/${id}/restore`),
  };
}
