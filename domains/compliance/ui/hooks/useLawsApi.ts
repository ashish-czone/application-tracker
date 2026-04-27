import { useEntityHooks } from '@packages/entity-engine-ui';

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

type LawsListResult = Omit<ReturnType<ReturnType<typeof useEntityHooks>['useList']>, 'data'> & {
  data?: PaginatedResponse<LawApiRecord>;
};

export function useLawsList(params: Record<string, unknown> = { limit: 500 }): LawsListResult {
  const hooks = useEntityHooks('laws');
  return hooks.useList(params) as unknown as LawsListResult;
}
