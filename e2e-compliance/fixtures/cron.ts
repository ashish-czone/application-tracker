import { apiClient } from '../helpers/api-client';

export interface FiredRule {
  ruleId: string;
  entityType: string;
  entityId: string;
  targetDate: string;
}

export interface RunGeneratorResult {
  ok: true;
  asOf: string;
  created: number;
}

export interface RunSchedulerResult {
  ok: true;
  asOf: string;
  fired: FiredRule[];
}

/**
 * Fire the compliance generator at a deterministic instant. The endpoint
 * iterates every active rule × active registration and materialises any
 * filing whose periodStart falls within the 12-month horizon ending at
 * `asOf`. Returns the count of new rows.
 *
 * Requires `ENABLE_TEST_HOOKS=true` on the API.
 */
export async function runGenerator(asOf: Date | string): Promise<RunGeneratorResult> {
  return apiClient.post<RunGeneratorResult>('/admin/test/cron/generator/run', {
    asOf: typeof asOf === 'string' ? asOf : asOf.toISOString(),
  });
}

/**
 * Fire the automations schedule scanner at a deterministic instant. Drives
 * every `schedule_recurring` rule whose `scheduleHour` matches the asOf
 * hour and whose date conditions match. Returns the rows added to
 * `automation_sent_log` during the scan — proof that the (rule × entity ×
 * targetDate) tuple matched and was queued. The action's downstream
 * effect (notification dispatch, etc.) follows asynchronously and is not
 * reflected in this response.
 *
 * Requires `ENABLE_TEST_HOOKS=true` on the API.
 */
export async function runScheduler(asOf: Date | string): Promise<RunSchedulerResult> {
  return apiClient.post<RunSchedulerResult>('/admin/test/cron/scheduler/run', {
    asOf: typeof asOf === 'string' ? asOf : asOf.toISOString(),
  });
}
