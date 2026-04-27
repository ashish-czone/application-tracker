import { apiClient } from '../helpers/api-client';
import { uniqueName, randomSuffix } from '../helpers/unique-name';

export type RuleStatus = 'draft' | 'active' | 'deprecated';
export type RuleFrequency = 'monthly' | 'quarterly' | 'half_yearly' | 'yearly';

export interface ComplianceRule {
  id: string;
  code: string;
  name: string;
  lawId: string;
  status: RuleStatus;
  frequency: RuleFrequency;
}

export interface CreateRuleOptions {
  lawId: string;
  code?: string;
  name?: string;
  frequency?: RuleFrequency;
  dueDayOfMonth?: number;
  dueMonthOffset?: number;
  gracePeriodDays?: number;
  status?: RuleStatus;
}

export async function createComplianceRule(opts: CreateRuleOptions): Promise<ComplianceRule> {
  return apiClient.post<ComplianceRule>('/compliance-rules', {
    code: opts.code ?? `E2E-${randomSuffix(6).toUpperCase()}`,
    name: opts.name ?? uniqueName('Rule'),
    lawId: opts.lawId,
    frequency: opts.frequency ?? 'monthly',
    dueDayOfMonth: opts.dueDayOfMonth ?? 20,
    dueMonthOffset: opts.dueMonthOffset ?? 1,
    gracePeriodDays: opts.gracePeriodDays ?? 0,
    status: opts.status ?? 'active',
  });
}

/** Workflow transition on a rule (draft → active → deprecated). Goes
 *  through the platform's transition endpoint so engine guards apply. */
export async function transitionComplianceRule(
  ruleId: string,
  to: RuleStatus,
  options: { reason?: string; comment?: string } = {},
): Promise<ComplianceRule> {
  return apiClient.post<ComplianceRule>(`/compliance-rules/${ruleId}/transition`, {
    fieldKey: 'status',
    to,
    ...(options.reason ? { reason: options.reason } : {}),
    ...(options.comment ? { comment: options.comment } : {}),
  });
}

/** Patch arbitrary rule fields. The service strips `status`; use
 *  `transitionComplianceRule` for workflow moves. */
export async function updateComplianceRule(
  ruleId: string,
  patch: Partial<Omit<CreateRuleOptions, 'lawId'>>,
): Promise<ComplianceRule> {
  return apiClient.patch<ComplianceRule>(`/compliance-rules/${ruleId}`, patch);
}

/** Deprecate a rule via the dedicated endpoint (rather than transition).
 *  Passes `alsoCancelInFlight` to indicate whether non-terminal filings
 *  generated under this rule should be cancelled — by default they are
 *  preserved (forward-only). */
export async function deprecateComplianceRule(
  ruleId: string,
  options: { alsoCancelInFlight?: boolean; comment?: string } = {},
): Promise<ComplianceRule> {
  return apiClient.post<ComplianceRule>(`/compliance-rules/${ruleId}/deprecate`, options);
}
