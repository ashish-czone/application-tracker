import { useEntityHooks } from '@packages/entity-engine-ui';

interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface ComplianceRuleRecord {
  id: string;
  code: string;
  name: string;
  lawId: string;
  frequency: string;
  status: string;
  dueDayOfMonth: number;
  dueMonthOffset: number;
  gracePeriodDays: number;
  description?: string | null;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface LawRecord {
  id: string;
  code: string;
  name: string;
  jurisdiction?: string | null;
  [key: string]: unknown;
}

type ComplianceRulesListResult = Omit<ReturnType<ReturnType<typeof useEntityHooks>['useList']>, 'data'> & {
  data?: PaginatedResponse<ComplianceRuleRecord>;
};

type LawsListResult = Omit<ReturnType<ReturnType<typeof useEntityHooks>['useList']>, 'data'> & {
  data?: PaginatedResponse<LawRecord>;
};

export function useComplianceRulesList(params: Record<string, unknown> = {}): ComplianceRulesListResult {
  const hooks = useEntityHooks('compliance_rules');
  return hooks.useList(params) as unknown as ComplianceRulesListResult;
}

export function useLawsLookup(params: Record<string, unknown> = { limit: 1000 }): LawsListResult {
  const hooks = useEntityHooks('laws');
  return hooks.useList(params) as unknown as LawsListResult;
}
