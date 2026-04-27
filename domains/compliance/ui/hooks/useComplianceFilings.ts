import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@packages/ui';
import { useEntityEngine, useEntityHooks } from '@packages/entity-engine-ui';
import { useOrgUnits } from '@packages/org-units-ui';
import type { OrgUnit } from '@packages/org-units-ui';
import type { FilingRow } from '../portals/customer/features/filings/types';
import type { Handler, Filing } from '../types';

interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

/**
 * Row shape returned by the generic entity-engine endpoint
 * GET /compliance-filings — the filings table columns. `status` is the
 * workflow state (pending | in_progress | review | completed | rejected |
 * cancelled); the UI derives the due-date bucket separately from `dueDate` +
 * `completedAt` via `computeFilingStatus`.
 */
interface ComplianceFilingRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigneeId: string | null;
  assigneeTeamId: string | null;
  dueDate: string | null;
  completedAt: string | null;
  ruleId: string;
  clientId: string;
  lawId: string;
  periodStart: string;
  periodEnd: string;
  externalKey: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RuleRecord {
  id: string;
  code: string;
  name: string;
  lawId: string;
}

interface LawRecord {
  id: string;
  code: string;
  name: string;
  jurisdiction?: string | null;
}

interface ClientRecord {
  id: string;
  name: string;
}

const PRIORITY_MAP: Record<string, FilingRow['priority']> = {
  urgent: 'critical',
  high: 'high',
  medium: 'normal',
  low: 'low',
};

function computeFilingStatus(filing: ComplianceFilingRow, today: Date): Filing['status'] {
  if (filing.completedAt) return 'filed';
  if (!filing.dueDate) return 'upcoming';
  const due = new Date(filing.dueDate);
  due.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return 'overdue';
  if (days === 0) return 'due-today';
  if (days <= 7) return 'due-this-week';
  return 'upcoming';
}

function initialsFromName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function unitToHandler(unit: OrgUnit | undefined): Handler | undefined {
  if (!unit) return undefined;
  const displayName = unit.head?.userName ?? unit.name;
  return {
    id: unit.id,
    name: displayName,
    initials: initialsFromName(displayName),
    role: unit.head?.positionName,
  };
}

function formatPeriodLabel(periodStart: string): string {
  if (!periodStart) return '';
  const d = new Date(periodStart);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

export interface ComplianceFilingsResult {
  rows: FilingRow[];
  loading: boolean;
  error: unknown;
  handlers: Handler[];
  clientOptions: { value: string; label: string }[];
  lawOptions: { value: string; label: string }[];
}

export function useComplianceFilingRows(): ComplianceFilingsResult {
  const { apiFn } = useEntityEngine();
  const rulesHooks = useEntityHooks('compliance-rules');
  const lawsHooks = useEntityHooks('laws');
  const clientsHooks = useEntityHooks('clients');

  const filingsQuery = useQuery<PaginatedResponse<ComplianceFilingRow>>({
    queryKey: ['compliance-filings', { limit: 1000 }],
    queryFn: () =>
      apiFn.get<PaginatedResponse<ComplianceFilingRow>>('/compliance-filings?limit=1000'),
  });
  const rulesQuery = rulesHooks.useList({ limit: 1000 });
  const lawsQuery = lawsHooks.useList({ limit: 1000 });
  const clientsQuery = clientsHooks.useList({ limit: 1000 });
  const orgUnitsQuery = useOrgUnits();

  const loading =
    filingsQuery.isLoading ||
    rulesQuery.isLoading ||
    lawsQuery.isLoading ||
    clientsQuery.isLoading ||
    orgUnitsQuery.isLoading;

  const error =
    filingsQuery.error ||
    rulesQuery.error ||
    lawsQuery.error ||
    clientsQuery.error ||
    orgUnitsQuery.error;

  const { rows, handlers, clientOptions, lawOptions } = useMemo(() => {
    const filings = filingsQuery.data?.data ?? [];
    const rules =
      (rulesQuery.data as PaginatedResponse<RuleRecord> | undefined)?.data ?? ([] as RuleRecord[]);
    const laws =
      (lawsQuery.data as PaginatedResponse<LawRecord> | undefined)?.data ?? ([] as LawRecord[]);
    const clients =
      (clientsQuery.data as PaginatedResponse<ClientRecord> | undefined)?.data ??
      ([] as ClientRecord[]);
    const units = orgUnitsQuery.data ?? [];

    const ruleById = new Map(rules.map((r) => [r.id, r]));
    const lawById = new Map(laws.map((l) => [l.id, l]));
    const clientById = new Map(clients.map((c) => [c.id, c]));
    const unitById = new Map(units.map((u) => [u.id, u]));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const builtRows = filings.map((t): FilingRow => {
      const rule = ruleById.get(t.ruleId);
      const law = lawById.get(t.lawId);
      const client = clientById.get(t.clientId);
      const unit = t.assigneeTeamId ? unitById.get(t.assigneeTeamId) : undefined;

      return {
        id: t.id,
        clientId: t.clientId,
        clientName: client?.name ?? '—',
        lawId: t.lawId,
        lawCode: law?.code ?? '',
        ruleName: rule?.name ?? t.title,
        dueDate: t.dueDate ?? '',
        periodLabel: formatPeriodLabel(t.periodStart),
        handler: unitToHandler(unit),
        jurisdiction: (law?.jurisdiction as Filing['jurisdiction']) ?? 'central',
        status: computeFilingStatus(t, today),
        priority: PRIORITY_MAP[t.priority] ?? 'normal',
        filedDate: t.completedAt ? t.completedAt.slice(0, 10) : undefined,
        notes: [],
        attachments: [],
        activity: [],
      };
    });

    const handlerList: Handler[] = units
      .map((u) => unitToHandler(u))
      .filter((h): h is Handler => h !== undefined);

    const clientOpts = clients
      .map((c) => ({ value: c.id, label: c.name }))
      .sort((a, b) => a.label.localeCompare(b.label));

    const lawOpts = laws
      .map((l) => ({ value: l.id, label: l.code ?? l.name }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return {
      rows: builtRows,
      handlers: handlerList,
      clientOptions: clientOpts,
      lawOptions: lawOpts,
    };
  }, [
    filingsQuery.data,
    rulesQuery.data,
    lawsQuery.data,
    clientsQuery.data,
    orgUnitsQuery.data,
  ]);

  return { rows, loading, error, handlers, clientOptions, lawOptions };
}

/**
 * Workflow states for compliance filings. Matches the 6-state state machine
 * declared in `domains/compliance/api/compliance-filings/compliance-filings.config.ts`.
 */
export type ComplianceFilingStatus =
  | 'pending'
  | 'in_progress'
  | 'review'
  | 'completed'
  | 'rejected'
  | 'cancelled';

export interface UpdateComplianceFilingPayload {
  status?: ComplianceFilingStatus;
  priority?: string;
  description?: string | null;
  assigneeId?: string | null;
  assigneeTeamId?: string | null;
  dueDate?: string | null;
  title?: string;
}

export function useUpdateComplianceFiling(options?: { silent?: boolean }) {
  const { apiFn } = useEntityEngine();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateComplianceFilingPayload }) =>
      apiFn.patch<unknown>(`/compliance-filings/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance-filings'] });
    },
    onError: (error: unknown) => {
      if (options?.silent) return;
      const message =
        (error as { body?: { message?: string } })?.body?.message ?? 'Failed to update filing';
      toast.error(message);
    },
  });
}
