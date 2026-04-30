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
  // Embedded by the server-side list path (joined from `compliance_laws`).
  lawCode?: string | null;
  lawName?: string | null;
  lawJurisdiction?: string | null;
  [key: string]: unknown;
}

export interface LawRecord {
  id: string;
  code: string;
  name: string;
  jurisdiction?: string | null;
  [key: string]: unknown;
}

export interface RulesSummary {
  total: number;
  byStatus: { active: number; draft: number; deprecated: number };
}

export interface ComplianceRulesListParams {
  page?: number;
  limit?: number;
  sort?: string;
  status?: 'active' | 'draft' | 'deprecated';
  /** Comma-separated frequencies. */
  frequency?: string;
  /** Comma-separated jurisdictions. */
  jurisdiction?: string;
  /** Comma-separated law-group keys (gst / itr / tds / roc / pt / pf / labour). */
  lawGroup?: string;
  /** Comma-separated law ids. */
  lawId?: string;
  q?: string;
}

type ComplianceRulesListResult = Omit<ReturnType<ReturnType<typeof useEntityHooks>['useList']>, 'data'> & {
  data?: PaginatedResponse<ComplianceRuleRecord>;
};

type LawsListResult = Omit<ReturnType<ReturnType<typeof useEntityHooks>['useList']>, 'data'> & {
  data?: PaginatedResponse<LawRecord>;
};

export function useComplianceRulesList(params: ComplianceRulesListParams = {}): ComplianceRulesListResult {
  const hooks = useEntityHooks('compliance-rules');
  return hooks.useList(params as Record<string, unknown>) as unknown as ComplianceRulesListResult;
}

/**
 * Status-bucket counts for the rules list page header. Single round-trip,
 * server-aggregated; replaces the prior pattern of counting client-side over
 * a `limit:200` page that would silently truncate past 200 rules.
 */
export function useComplianceRulesSummary() {
  const { apiFn } = useEntityEngine();
  return useQuery({
    queryKey: ['compliance-rules', 'summary'],
    queryFn: () => apiFn.get<RulesSummary>('/compliance-rules/summary'),
  });
}

/**
 * Generic laws lookup. Accepts the same params the entity-engine list
 * endpoint takes (page / limit / search). The previous default `limit: 1000`
 * was the data-fetching rule's hard prohibition — callers must now pass an
 * explicit limit sized to the surface they're rendering.
 */
export function useLawsLookup(params: Record<string, unknown> = {}): LawsListResult {
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
      queryClient.invalidateQueries({ queryKey: ['compliance-rules'] });
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

export interface RuleEditConstraints {
  ruleId: string;
  hasGeneratedFilings: boolean;
  generatedFilingCount: number;
}

/**
 * I15: fetches `{ hasGeneratedFilings, generatedFilingCount }` for the rule
 * edit form. Drives the disabled state on `code`/`frequency`/`lawId` and
 * the "N filings already generated" copy in the forward-only save dialog.
 */
export function useRuleEditConstraints(ruleId: string | null | undefined) {
  const { apiFn } = useEntityEngine();
  return useQuery({
    queryKey: ['rule-edit-constraints', ruleId],
    queryFn: () =>
      apiFn.get<RuleEditConstraints>(
        `/compliance-rules/${ruleId}/edit-constraints`,
      ),
    enabled: !!ruleId,
    staleTime: 0,
  });
}

export interface UpdateComplianceRulePayload {
  ruleId: string;
  data: Partial<Pick<ComplianceRuleRecord, 'code' | 'name' | 'lawId' | 'frequency' | 'dueDayOfMonth' | 'dueMonthOffset' | 'gracePeriodDays' | 'description'>>;
}

/**
 * I15: domain PATCH against the compliance-rules custom controller. The
 * controller runs the I14 identity-field guard and returns the updated
 * rule. Server-side errors (e.g. RULE_FIELD_IMMUTABLE) surface through
 * `onError` — the form uses the backend as the ultimate backstop.
 */
export function useUpdateComplianceRule(options?: {
  onSuccess?: (result: ComplianceRuleRecord) => void;
}) {
  const { apiFn } = useEntityEngine();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ruleId, data }: UpdateComplianceRulePayload) =>
      apiFn.patch<ComplianceRuleRecord>(`/compliance-rules/${ruleId}`, data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['compliance-rules'] });
      queryClient.invalidateQueries({ queryKey: ['rule-edit-constraints', result.id] });
      queryClient.invalidateQueries({ queryKey: ['audit'] });
      toast.success('Rule updated');
      options?.onSuccess?.(result);
    },
    onError: (error: unknown) => {
      const body = (error as { body?: { message?: string; code?: string } })?.body;
      toast.error(body?.message ?? 'Failed to update rule');
    },
  });
}
