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
