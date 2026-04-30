import { useEntityHooks } from '@packages/entity-engine-ui';

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

/**
 * Returns law assignments for a single org unit. The list response embeds
 * `lawCode` / `lawName` per row via server-side composition in
 * LawHandlersService — no second query and no client-side join.
 */
export function useLawHandlersByOrgUnit(
  orgEntityId: string | null | undefined,
): OrgUnitLawAssignmentsResult {
  const lawHandlersHooks = useEntityHooks('law-handlers');

  const handlersQuery = lawHandlersHooks.useList(
    orgEntityId ? { orgEntityId, limit: 100 } : { limit: 0 },
  );

  if (!orgEntityId) {
    return { data: [], isLoading: false, error: null };
  }

  const handlers =
    (handlersQuery.data as PaginatedResponse<LawHandlerRow> | undefined)?.data ?? [];
  return {
    data: handlers.map(projectLawHandler),
    isLoading: handlersQuery.isLoading,
    error: handlersQuery.error,
  };
}
