import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@packages/ui';
import { useEntityEngine } from '@packages/entity-engine-ui';

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

type ApiFn = {
  get: <T>(path: string) => Promise<T>;
  post: <T>(path: string, body?: unknown) => Promise<T>;
  patch: <T>(path: string, body?: unknown) => Promise<T>;
  delete: <T>(path: string) => Promise<T>;
};

const BASE = '/compliance-rules';

export const rulesQueryKey = ['compliance-rules'] as const;

/**
 * `queryOptions` factory for compliance-rules reads. Pages call
 * `useQuery(rulesQueries(apiFn).list(params))` directly rather than going
 * through the entity-engine FE registry. queryKey + URL stay colocated so
 * cross-page lists can't drift to incompatible cache keys.
 */
export function rulesQueries(apiFn: ApiFn) {
  return {
    list: (params: ComplianceRulesListParams = {}) =>
      queryOptions({
        queryKey: [...rulesQueryKey, 'list', params] as const,
        queryFn: () =>
          apiFn.get<PaginatedResponse<ComplianceRuleRecord>>(
            `${BASE}${buildQuery(params as Record<string, unknown>)}`,
          ),
      }),
    detail: (id: string | null | undefined) =>
      queryOptions({
        queryKey: [...rulesQueryKey, 'detail', id] as const,
        queryFn: () => apiFn.get<ComplianceRuleRecord>(`${BASE}/${id}`),
        enabled: !!id,
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
 * Status-bucket counts for the rules list page header. Single round-trip,
 * server-aggregated; replaces the prior pattern of counting client-side over
 * a `limit:200` page that would silently truncate past 200 rules.
 */
export function useComplianceRulesSummary() {
  const { apiFn } = useEntityEngine();
  return useQuery({
    queryKey: [...rulesQueryKey, 'summary'],
    queryFn: () => apiFn.get<RulesSummary>(`${BASE}/summary`),
  });
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
    queryKey: [...rulesQueryKey, 'deprecation-preview', ruleId],
    queryFn: () =>
      apiFn.get<RuleDeprecationPreview>(`${BASE}/${ruleId}/deprecation-preview`),
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
      apiFn.post<DeprecateRuleResult>(`${BASE}/${ruleId}/deprecate`, body),
    onSuccess: (result) => {
      // Rules list tabs depend on status counts; filings may have been
      // cancelled; audit timeline should show the new transition.
      queryClient.invalidateQueries({ queryKey: rulesQueryKey });
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
    queryKey: [...rulesQueryKey, 'edit-constraints', ruleId],
    queryFn: () =>
      apiFn.get<RuleEditConstraints>(`${BASE}/${ruleId}/edit-constraints`),
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
      apiFn.patch<ComplianceRuleRecord>(`${BASE}/${ruleId}`, data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: rulesQueryKey });
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

/**
 * Create a new compliance rule. Invalidates the rules root query key on
 * success so list/summary views refetch. Mirrors the prior
 * `useEntityHooks('compliance-rules').useCreate` behaviour without going
 * through the registry.
 */
export function useCreateComplianceRule(options?: {
  onSuccess?: (rule: ComplianceRuleRecord) => void;
}) {
  const { apiFn } = useEntityEngine();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiFn.post<ComplianceRuleRecord>(BASE, data),
    onSuccess: (rule) => {
      qc.invalidateQueries({ queryKey: rulesQueryKey });
      toast.success('Compliance Rule created');
      options?.onSuccess?.(rule);
    },
    onError: (error: unknown) => {
      const message =
        (error as { body?: { message?: string } })?.body?.message ??
        'Failed to create compliance rule';
      toast.error(message);
    },
  });
}
