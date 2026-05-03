import { useMemo } from 'react';
import { queryOptions, useInfiniteQuery } from '@tanstack/react-query';
import { useEntityEngine } from '@packages/entity-engine-ui';

interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface LawHandlerRow {
  id: string;
  lawId: string;
  orgEntityId: string;
  clientId: string | null;
  isPrimary: boolean;
  /** Embedded by LawHandlersService.list() via service composition. */
  lawCode?: string;
  lawName?: string;
  lawJurisdiction?: string | null;
}

export interface OrgUnitLawAssignment {
  /** law-handler row id */
  id: string;
  lawId: string;
  lawCode: string;
  lawName: string;
  isPrimary: boolean;
  /** True for global default handlers (no per-client override). */
  isGlobal: boolean;
}

export interface OrgUnitLawAssignmentsResult {
  data: OrgUnitLawAssignment[];
  /** Server-known total of assignments for this unit (across all pages). */
  total: number;
  /** A page beyond `data.length` exists. */
  hasMore: boolean;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  error: unknown;
}

export function projectLawHandler(h: LawHandlerRow): OrgUnitLawAssignment {
  return {
    id: h.id,
    lawId: h.lawId,
    lawCode: h.lawCode ?? '—',
    lawName: h.lawName ?? 'Unknown law',
    isPrimary: h.isPrimary,
    isGlobal: h.clientId === null,
  };
}

type ApiFn = {
  get: <T>(path: string) => Promise<T>;
  post: <T>(path: string, body?: unknown) => Promise<T>;
  patch: <T>(path: string, body?: unknown) => Promise<T>;
  delete: <T>(path: string) => Promise<T>;
};

const BASE = '/law-handlers';
const DEFAULT_PAGE_SIZE = 25;

export const lawHandlersQueryKey = ['law-handlers'] as const;

/**
 * `queryOptions` factory for law-handlers reads. Pages call
 * `useQuery(lawHandlersQueries(apiFn).list(params))` directly rather than
 * going through the entity-engine FE registry.
 */
export function lawHandlersQueries(apiFn: ApiFn) {
  return {
    list: (params: Record<string, unknown> = {}) =>
      queryOptions({
        queryKey: [...lawHandlersQueryKey, 'list', params] as const,
        queryFn: () =>
          apiFn.get<PaginatedResponse<LawHandlerRow>>(`${BASE}${buildQuery(params)}`),
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

/**
 * Returns law assignments for a single org unit, paginated. The list
 * response embeds `lawCode` / `lawName` per row via server-side composition
 * in LawHandlersService — no second query and no client-side join.
 *
 * Replaces the previous single-shot `?limit=100` fetch (silent truncation
 * the moment a unit handles > 100 laws). `useInfiniteQuery` mirrors
 * `useFilingsBucketInfinite` / `useFilingsRangeInfinite`: callers render
 * `data` and surface `total`, `hasMore`, `fetchNextPage` as a "Showing N
 * of M — Load more" affordance per `.claude/rules/data-fetching.md`.
 */
export function useLawHandlersByOrgUnit(
  orgEntityId: string | null | undefined,
  options: { limit?: number } = {},
): OrgUnitLawAssignmentsResult {
  const { apiFn } = useEntityEngine();
  const limit = options.limit ?? DEFAULT_PAGE_SIZE;
  const enabled = !!orgEntityId;

  const query = useInfiniteQuery<PaginatedResponse<LawHandlerRow>>({
    queryKey: [
      ...lawHandlersQueryKey,
      'list',
      'by-org-unit',
      { orgEntityId: orgEntityId ?? null, limit },
    ] as const,
    queryFn: ({ pageParam = 1 }) =>
      apiFn.get<PaginatedResponse<LawHandlerRow>>(
        `${BASE}${buildQuery({ orgEntityId, limit, page: pageParam })}`,
      ),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const next = lastPage.meta.page + 1;
      return next <= lastPage.meta.totalPages ? next : undefined;
    },
    enabled,
    placeholderData: (prev) => prev,
  });

  const rows = useMemo(
    () => (query.data?.pages ?? []).flatMap((p) => p.data),
    [query.data],
  );
  const data = useMemo(() => rows.map(projectLawHandler), [rows]);
  const total = query.data?.pages[0]?.meta.total ?? 0;

  return {
    data: enabled ? data : [],
    total: enabled ? total : 0,
    hasMore: enabled ? (query.hasNextPage ?? false) : false,
    isLoading: enabled ? query.isLoading : false,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: () => {
      void query.fetchNextPage();
    },
    error: enabled ? query.error : null,
  };
}

