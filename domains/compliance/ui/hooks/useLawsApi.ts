import { useQuery } from '@tanstack/react-query';
import { useEntityEngine, useEntityHooks } from '@packages/entity-engine-ui';

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

type LawsListResult = Omit<ReturnType<ReturnType<typeof useEntityHooks>['useList']>, 'data'> & {
  data?: PaginatedResponse<LawApiRecord>;
};

/**
 * Generic flat laws list. Callers must pass an explicit `limit` sized to the
 * surface they're rendering — the previous default `limit: 500` was the
 * data-fetching rule's prohibition (silent truncation past 500).
 */
export function useLawsList(params: Record<string, unknown> = {}): LawsListResult {
  const hooks = useEntityHooks('laws');
  return hooks.useList(params) as unknown as LawsListResult;
}

/**
 * Server-built law hierarchy + per-jurisdiction counts. Replaces the prior
 * pattern of `useLawsList({ limit: 500 })` + client-side `buildLawTree`,
 * which silently truncated past 500 and computed jurisdiction counts off
 * the truncated set.
 */
export function useLawsTree(params: { jurisdiction?: LawJurisdiction } = {}) {
  const { apiFn } = useEntityEngine();
  const search = params.jurisdiction
    ? `?jurisdiction=${encodeURIComponent(params.jurisdiction)}`
    : '';
  return useQuery({
    queryKey: ['laws', 'tree', params.jurisdiction ?? null],
    queryFn: () => apiFn.get<LawTreeResponse>(`/laws/tree${search}`),
  });
}
