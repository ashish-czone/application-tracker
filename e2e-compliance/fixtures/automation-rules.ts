import { apiClient } from '../helpers/api-client';
import { uniqueName } from '../helpers/unique-name';

export type ActionConfig = {
  type: string;
  config?: Record<string, unknown>;
  users?: Record<string, unknown>;
  link?: { as: string };
};

export interface ScheduleRule {
  id: string;
  name: string;
  triggerType: string;
  scheduleEntityType: string | null;
  scheduleHour: number | null;
  isActive: boolean;
}

export interface CreateScheduleRuleOptions {
  name?: string;
  scheduleEntityType: string;
  scheduleHour?: number;
  scheduleDaysOfWeek?: number[];
  scheduleDateField?: string;
  scheduleDateOperator?: 'before' | 'after';
  scheduleDateAmounts?: number[];
  scheduleDateUnit?: 'days' | 'hours' | 'minutes';
  conditions?: Array<Record<string, unknown>>;
  actions?: ActionConfig[];
  isActive?: boolean;
}

/**
 * Creates a `schedule_recurring` automation rule via the API. Defaults
 * are sized for the e2e suite — minimal action set (one webhook stub),
 * no day-of-week restriction, no date conditions unless the caller
 * supplies them. Pass `scheduleEntityType` to bind the rule to an
 * entity table (e.g., `compliance-filings`) and `scheduleHour` to set
 * the firing hour in APP_TIMEZONE.
 */
export async function createScheduleRule(
  opts: CreateScheduleRuleOptions,
): Promise<ScheduleRule> {
  return apiClient.post<ScheduleRule>('/automation-rules', {
    name: opts.name ?? uniqueName('Rule'),
    triggerType: 'schedule_recurring',
    scheduleEntityType: opts.scheduleEntityType,
    scheduleHour: opts.scheduleHour ?? 2,
    scheduleDaysOfWeek: opts.scheduleDaysOfWeek ?? [0, 1, 2, 3, 4, 5, 6],
    scheduleDateField: opts.scheduleDateField,
    scheduleDateOperator: opts.scheduleDateOperator,
    scheduleDateAmounts: opts.scheduleDateAmounts,
    scheduleDateUnit: opts.scheduleDateUnit,
    conditions: opts.conditions ?? [],
    actions: opts.actions ?? [
      { type: 'webhook', config: { url: 'http://localhost:9999/e2e-noop' } },
    ],
    isActive: opts.isActive ?? true,
  });
}
