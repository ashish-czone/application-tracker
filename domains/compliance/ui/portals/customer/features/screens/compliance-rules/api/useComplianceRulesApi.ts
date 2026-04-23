import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@packages/ui';
import { useEntityEngine, useEntityHooks } from '@packages/entity-engine-ui';

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

export interface RuleDeprecationPreview {
  ruleId: string;
  inFlightFilingCount: number;
}

export interface DeprecateRulePayload {
  ruleId: string;
  alsoCancelInFlight?: boolean;
  comment?: string;
}

export interface DeprecateRuleResult {
  ruleId: string;
  cancelledFilingIds: string[];
}

/**
 * Fetches the non-terminal filing count for a rule so the deprecation dialog
 * (I10) can render "Also cancel N in-flight filings from this rule." live.
 * `ruleId` null → disabled (dialog closed). `staleTime: 0` so the count
 * refetches on every open rather than flashing a stale number from a prior
 * dialog open.
 */
export function useRuleDeprecationPreview(ruleId: string | null) {
  const { apiFn } = useEntityEngine();
  return useQuery({
    queryKey: ['rule-deprecation-preview', ruleId],
    queryFn: () =>
      apiFn.get<RuleDeprecationPreview>(
        `/compliance-rules/${ruleId}/deprecation-preview`,
      ),
    enabled: !!ruleId,
    staleTime: 0,
    gcTime: 0,
  });
}

export function useDeprecateRule(options?: {
  onSuccess?: (result: DeprecateRuleResult) => void;
}) {
  const { apiFn } = useEntityEngine();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ruleId, ...body }: DeprecateRulePayload) =>
      apiFn.post<DeprecateRuleResult>(
        `/compliance-rules/${ruleId}/deprecate`,
        body,
      ),
    onSuccess: (result) => {
      // Rules list tabs depend on status counts; filings may have been
      // cancelled; audit timeline should show the new transition.
      queryClient.invalidateQueries({ queryKey: ['compliance_rules'] });
      queryClient.invalidateQueries({ queryKey: ['compliance-filings'] });
      queryClient.invalidateQueries({ queryKey: ['audit'] });
      toast.success('Rule deprecated');
      options?.onSuccess?.(result);
    },
    onError: (error: unknown) => {
      const message =
        (error as { body?: { message?: string } })?.body?.message ??
        'Failed to deprecate rule';
      toast.error(message);
    },
  });
}
