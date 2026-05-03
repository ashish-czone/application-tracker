import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@packages/ui';
import { useEntityEngine } from '@packages/entity-engine-ui';

interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface LawApiRecord {
  id: string;
  code: string;
  name: string;
  jurisdiction?: string | null;
  effectiveFrom?: string | null;
  issuingAuthority?: string | null;
  description?: string | null;
  parentId?: string | null;
  depth?: number | null;
  path?: string | null;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export type LawJurisdiction = 'central' | 'state' | 'municipal' | 'international';

export interface LawTreeApiNode {
  id: string;
  parentId: string | null;
  code: string;
  name: string;
  jurisdiction: LawJurisdiction;
  effectiveFrom: string | null;
  children?: LawTreeApiNode[];
}

export interface LawTreeResponse {
  tree: LawTreeApiNode[];
  counts: Record<LawJurisdiction, number>;
}

type ApiFn = {
  get: <T>(path: string) => Promise<T>;
  post: <T>(path: string, body?: unknown) => Promise<T>;
  patch: <T>(path: string, body?: unknown) => Promise<T>;
  delete: <T>(path: string) => Promise<T>;
};

const BASE = '/laws';

export const lawsQueryKey = ['laws'] as const;

/**
 * `queryOptions` factory for the laws entity. Pages call
 * `useQuery(lawsQueries(apiFn).list(params))` rather than going through the
 * entity-engine FE registry. Keeps queryKey + URL + caching defaults
 * colocated so multiple call sites can't drift to incompatible keys.
 */
export function lawsQueries(apiFn: ApiFn) {
  return {
    list: (params: Record<string, unknown> = {}) =>
      queryOptions({
        queryKey: [...lawsQueryKey, 'list', params] as const,
        queryFn: () =>
          apiFn.get<PaginatedResponse<LawApiRecord>>(`${BASE}${buildQuery(params)}`),
      }),
    tree: (params: { jurisdiction?: LawJurisdiction } = {}) =>
      queryOptions({
        queryKey: [...lawsQueryKey, 'tree', params.jurisdiction ?? null] as const,
        queryFn: () => {
          const search = params.jurisdiction
            ? `?jurisdiction=${encodeURIComponent(params.jurisdiction)}`
            : '';
          return apiFn.get<LawTreeResponse>(`${BASE}/tree${search}`);
        },
      }),
  };
}

function buildQuery(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '' && v !== false) sp.set(k, String(v));
  }
  if (sp.get('page') === '1') sp.delete('page');
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

// ─────────────────────────────────────────────────────────────────────────────
// Typeahead options — backs `<LawPicker />` and any law filter dropdown.
// Replaces the previous `limit=1000` page-fetch pattern (a data-fetching.md
// violation) with a server-side ILIKE on code + name.
// ─────────────────────────────────────────────────────────────────────────────

export interface LawOption {
  id: string;
  code: string;
  name: string;
}

export interface LawOptionsParams {
  /** Substring query (server ILIKEs code + name, case-insensitive). */
  search?: string;
  /**
   * Hydrate labels for already-selected chips. When present, server bypasses
   * `search` and returns only rows whose id is in this set, so a reopened
   * page can show its filter chips with codes regardless of search state.
   */
  ids?: readonly string[];
  /** Defaults to 25 server-side; clamped to 50 max. */
  limit?: number;
}

function normaliseIds(ids: readonly string[] | undefined): string[] | undefined {
  if (!ids || ids.length === 0) return undefined;
  return [...new Set(ids)].sort();
}

function buildOptionsQuery(params: LawOptionsParams): string {
  const sp = new URLSearchParams();
  if (params.search) sp.set('search', params.search);
  const ids = normaliseIds(params.ids);
  if (ids) sp.set('ids', ids.join(','));
  if (params.limit != null) sp.set('limit', String(params.limit));
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

/**
 * `<LawPicker>` and friends use this for the typeahead dropdown.
 * `placeholderData: keepPrevious` keeps the previous results visible while a
 * new search query is in-flight so the dropdown doesn't collapse on every
 * keystroke.
 */
export function useLawOptions(params: LawOptionsParams = {}) {
  const { apiFn } = useEntityEngine();
  const ids = normaliseIds(params.ids);
  return useQuery({
    queryKey: [...lawsQueryKey, 'options', { search: params.search ?? '', ids: ids ?? null, limit: params.limit ?? null }] as const,
    queryFn: () => apiFn.get<LawOption[]>(`${BASE}/options${buildOptionsQuery(params)}`),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
}

export const __test__ = { buildOptionsQuery, normaliseIds };

export function useCreateLaw(options?: { onSuccess?: (law: LawApiRecord) => void }) {
  const { apiFn } = useEntityEngine();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiFn.post<LawApiRecord>(BASE, data),
    onSuccess: (law) => {
      qc.invalidateQueries({ queryKey: lawsQueryKey });
      toast.success('Law created');
      options?.onSuccess?.(law);
    },
    onError: (error: unknown) => {
      const message =
        (error as { body?: { message?: string } })?.body?.message ?? 'Failed to create law';
      toast.error(message);
    },
  });
}
