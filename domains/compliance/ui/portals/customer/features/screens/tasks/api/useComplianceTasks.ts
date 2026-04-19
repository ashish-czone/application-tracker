import { useMemo } from 'react';
import { useEntityHooks } from '@packages/entity-engine-ui';
import { useOrgUnits } from '@packages/org-units-ui';
import type { OrgUnit } from '@packages/org-units-ui';
import type { FilingRow } from '../../filings/data/filingsMock';
import type { Handler, Filing } from '../../../../../../shared/types';

interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface TaskRecord {
  id: string;
  title: string;
  status: string;
  priority: string;
  assigneeId?: string | null;
  assigneeTeamId?: string | null;
  dueDate?: string | null;
  completedAt?: string | null;
  kind?: string | null;
  relatedEntityId?: string | null;
  externalKey?: string | null;
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

function computeFilingStatus(task: TaskRecord, today: Date): Filing['status'] {
  if (task.completedAt) return 'filed';
  if (!task.dueDate) return 'upcoming';
  const due = new Date(task.dueDate);
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

function parseExternalKey(externalKey?: string | null): { clientId: string; periodStart: string } {
  if (!externalKey) return { clientId: '', periodStart: '' };
  const parts = externalKey.split(':');
  if (parts.length < 3) return { clientId: '', periodStart: '' };
  return { clientId: parts[parts.length - 2], periodStart: parts[parts.length - 1] };
}

function formatPeriodLabel(periodStart: string): string {
  if (!periodStart) return '';
  const d = new Date(periodStart);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

export interface ComplianceTasksResult {
  rows: FilingRow[];
  loading: boolean;
  error: unknown;
  handlers: Handler[];
  clientOptions: { value: string; label: string }[];
  lawOptions: { value: string; label: string }[];
}

export function useComplianceTaskRows(): ComplianceTasksResult {
  const tasksHooks = useEntityHooks('tasks');
  const rulesHooks = useEntityHooks('compliance_rules');
  const lawsHooks = useEntityHooks('laws');
  const clientsHooks = useEntityHooks('clients');

  const tasksQuery = tasksHooks.useList({ kind: 'compliance', limit: 1000 });
  const rulesQuery = rulesHooks.useList({ limit: 1000 });
  const lawsQuery = lawsHooks.useList({ limit: 1000 });
  const clientsQuery = clientsHooks.useList({ limit: 1000 });
  const orgUnitsQuery = useOrgUnits();

  const loading =
    tasksQuery.isLoading ||
    rulesQuery.isLoading ||
    lawsQuery.isLoading ||
    clientsQuery.isLoading ||
    orgUnitsQuery.isLoading;

  const error =
    tasksQuery.error ||
    rulesQuery.error ||
    lawsQuery.error ||
    clientsQuery.error ||
    orgUnitsQuery.error;

  const { rows, handlers, clientOptions, lawOptions } = useMemo(() => {
    const tasks =
      (tasksQuery.data as PaginatedResponse<TaskRecord> | undefined)?.data ?? ([] as TaskRecord[]);
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

    const builtRows = tasks.map((t): FilingRow => {
      const rule = t.relatedEntityId ? ruleById.get(t.relatedEntityId) : undefined;
      const law = rule?.lawId ? lawById.get(rule.lawId) : undefined;
      const { clientId, periodStart } = parseExternalKey(t.externalKey);
      const client = clientId ? clientById.get(clientId) : undefined;
      const unit = t.assigneeTeamId ? unitById.get(t.assigneeTeamId) : undefined;

      return {
        id: t.id,
        clientId,
        clientName: client?.name ?? '—',
        lawId: rule?.lawId ?? '',
        lawCode: law?.code ?? '',
        ruleName: rule?.name ?? t.title,
        dueDate: t.dueDate ?? '',
        periodLabel: formatPeriodLabel(periodStart),
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
    tasksQuery.data,
    rulesQuery.data,
    lawsQuery.data,
    clientsQuery.data,
    orgUnitsQuery.data,
  ]);

  return { rows, loading, error, handlers, clientOptions, lawOptions };
}
