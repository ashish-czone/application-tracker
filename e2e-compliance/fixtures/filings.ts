import { apiClient } from '../helpers/api-client';
import { uniqueName } from '../helpers/unique-name';

export type FilingStatus = 'pending' | 'in_progress' | 'review' | 'completed' | 'cancelled' | 'rejected';

export interface ComplianceFiling {
  id: string;
  title: string;
  status: FilingStatus;
  ruleId: string;
  clientId: string;
  lawId: string;
  assigneeTeamId: string;
  assigneeId: string | null;
  periodStart: string;
  periodEnd: string;
  dueDate: string | null;
}

export interface CreateFilingOptions {
  ruleId: string;
  clientId: string;
  lawId: string;
  assigneeTeamId: string;
  title?: string;
  status?: FilingStatus;
  periodStart?: string;
  periodEnd?: string;
  dueDate?: string;
  assigneeId?: string | null;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function createComplianceFiling(opts: CreateFilingOptions): Promise<ComplianceFiling> {
  const today = new Date();
  const periodStart = opts.periodStart ?? isoDate(new Date(today.getFullYear(), today.getMonth(), 1));
  const periodEnd = opts.periodEnd ?? isoDate(new Date(today.getFullYear(), today.getMonth() + 1, 0));
  const dueDate = opts.dueDate ?? isoDate(new Date(today.getFullYear(), today.getMonth() + 1, 20));

  return apiClient.post<ComplianceFiling>('/compliance-filings', {
    title: opts.title ?? uniqueName('Filing'),
    status: opts.status ?? 'pending',
    ruleId: opts.ruleId,
    clientId: opts.clientId,
    lawId: opts.lawId,
    assigneeTeamId: opts.assigneeTeamId,
    assigneeId: opts.assigneeId ?? null,
    periodStart,
    periodEnd,
    dueDate,
  });
}

/** Patch a filing field directly. Used for assignee changes (pickup,
 *  reassign) — not for status, which goes through `transitionFiling`. */
export async function updateFiling(
  filingId: string,
  patch: Partial<{ assigneeId: string | null; title: string; dueDate: string }>,
): Promise<ComplianceFiling> {
  return apiClient.patch<ComplianceFiling>(`/compliance-filings/${filingId}`, patch);
}

/** Run a workflow transition on a filing (pending→in_progress for
 *  pickup, in_progress→review for submit, etc.). */
export async function transitionFiling(
  filingId: string,
  to: FilingStatus,
  options: { reason?: string; comment?: string } = {},
): Promise<ComplianceFiling> {
  return apiClient.post<ComplianceFiling>(`/compliance-filings/${filingId}/transition`, {
    fieldKey: 'status',
    to,
    ...(options.reason ? { reason: options.reason } : {}),
    ...(options.comment ? { comment: options.comment } : {}),
  });
}
