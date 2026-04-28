import { useMemo } from 'react';
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
}

export interface LawRow {
  id: string;
  code: string;
  name: string;
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

/**
 * Pure join: pair each law-handler row with its law (by lawId) and project the
 * UI-friendly assignment shape. Exported separately so the merging logic can
 * be unit-tested without mocking TanStack Query.
 */
export function joinLawHandlersWithLaws(
  handlers: LawHandlerRow[],
  laws: LawRow[],
): OrgUnitLawAssignment[] {
  const lawById = new Map(laws.map((l) => [l.id, l]));
  return handlers.map((h) => {
    const law = lawById.get(h.lawId);
    return {
      id: h.id,
      lawId: h.lawId,
      lawCode: law?.code ?? '—',
      lawName: law?.name ?? 'Unknown law',
      isPrimary: h.isPrimary,
      isGlobal: h.clientId === null,
    };
  });
}

/**
 * Returns the law assignments for a single org unit. Fetches the law-handlers
 * filtered server-side by orgEntityId and joins with the laws list to surface
 * the human-readable code and name. Filing-derived stats (totalObligations,
 * compliant, overdue) are intentionally excluded — those land via the reports
 * aggregation endpoint in a follow-up.
 */
export function useLawHandlersByOrgUnit(
  orgEntityId: string | null | undefined,
): OrgUnitLawAssignmentsResult {
  const lawHandlersHooks = useEntityHooks('law-handlers');
  const lawsHooks = useEntityHooks('laws');

  const handlersQuery = lawHandlersHooks.useList(
    orgEntityId ? { orgEntityId, limit: 200 } : { limit: 0 },
  );
  const lawsQuery = lawsHooks.useList({ limit: 500 });

  const data = useMemo<OrgUnitLawAssignment[]>(() => {
    if (!orgEntityId) return [];
    const handlers =
      (handlersQuery.data as PaginatedResponse<LawHandlerRow> | undefined)?.data ?? [];
    const laws = (lawsQuery.data as PaginatedResponse<LawRow> | undefined)?.data ?? [];
    return joinLawHandlersWithLaws(handlers, laws);
  }, [orgEntityId, handlersQuery.data, lawsQuery.data]);

  return {
    data,
    isLoading: !!orgEntityId && (handlersQuery.isLoading || lawsQuery.isLoading),
    error: handlersQuery.error ?? lawsQuery.error,
  };
}
