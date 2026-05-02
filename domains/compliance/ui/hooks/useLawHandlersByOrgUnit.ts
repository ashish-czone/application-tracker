import { queryOptions, useQuery } from '@tanstack/react-query';
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

interface OrgUnitLawAssignmentsResult {
  data: OrgUnitLawAssignment[];
  isLoading: boolean;
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
 * Returns law assignments for a single org unit. The list response embeds
 * `lawCode` / `lawName` per row via server-side composition in
 * LawHandlersService — no second query and no client-side join.
 */
export function useLawHandlersByOrgUnit(
  orgEntityId: string | null | undefined,
): OrgUnitLawAssignmentsResult {
  const { apiFn } = useEntityEngine();
  const handlersQuery = useQuery(
    lawHandlersQueries(apiFn).list(
      orgEntityId ? { orgEntityId, limit: 100 } : { limit: 0 },
    ),
  );

  if (!orgEntityId) {
    return { data: [], isLoading: false, error: null };
  }

  const handlers = handlersQuery.data?.data ?? [];
  return {
    data: handlers.map(projectLawHandler),
    isLoading: handlersQuery.isLoading,
    error: handlersQuery.error,
  };
}
