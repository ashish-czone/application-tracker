import type { Handler } from '../../../../../types';
import type { ClientDetail, ClientFiling, ClientFilingStatus, ClientLaw, ClientStatus, ClientRiskLevel } from '../types';
import type { ClientRecord, ClientContactRecord } from '../../../../../hooks/useClientsApi';
import type { FilingsSummary } from '../../../../../hooks/useFilingsSummary';
import type { FilingListRow } from '../../../../../hooks/useFilingsByDueWindow';
import type { ClientRegistrationRecord } from '../../../../../hooks/useClientDetailData';
import { initialsFromName, colorForClient } from './mapClientRecord';

const UNASSIGNED_HANDLER: Handler = {
  id: 'unassigned',
  name: 'Unassigned',
  initials: '—',
};

const STATUS_VALUES: ClientStatus[] = ['active', 'onboarding', 'dormant'];

function normalizeStatus(status: string | null | undefined): ClientStatus {
  if (status && (STATUS_VALUES as string[]).includes(status)) {
    return status as ClientStatus;
  }
  return 'onboarding';
}

function formatAddress(record: ClientRecord): string {
  const parts = [
    record.addressLine1,
    record.addressLine2,
    [record.city, record.state].filter(Boolean).join(', '),
    record.postalCode,
  ]
    .map((v) => (v ?? '').toString().trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : '—';
}

function contactToShape(c: ClientContactRecord) {
  return {
    name: c.fullName,
    email: c.primaryEmail ?? '—',
    phone: c.primaryPhone ?? '—',
    designation: c.complianceDesignation ?? '—',
  };
}

function deriveFilingStatus(row: FilingListRow): ClientFilingStatus {
  if (row.status === 'completed' || row.status === 'cancelled') return 'filed';
  if (!row.dueDate) return 'upcoming';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(row.dueDate);
  due.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return 'overdue';
  if (days === 0) return 'due-today';
  if (days <= 7) return 'due-this-week';
  return 'upcoming';
}

const PRIORITY_MAP: Record<string, ClientFiling['priority']> = {
  urgent: 'critical',
  high: 'high',
  medium: 'normal',
  low: 'low',
};

function formatPeriod(periodStart: string | null | undefined): string {
  if (!periodStart) return '—';
  const d = new Date(periodStart);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

function filingRowToClientFiling(row: FilingListRow): ClientFiling {
  const j = row.lawJurisdiction;
  const jurisdiction: ClientFiling['jurisdiction'] = j === 'state' ? 'state' : 'central';
  return {
    id: row.id,
    lawCode: row.lawCode ?? '',
    // Rule name is not joined server-side today; fall back to the filing's own title.
    ruleName: row.title,
    period: formatPeriod(row.periodStart),
    dueDate: row.dueDate ?? '',
    filedDate: row.completedAt ? row.completedAt.slice(0, 10) : undefined,
    status: deriveFilingStatus(row),
    priority: PRIORITY_MAP[row.priority] ?? 'normal',
    handler: row.assigneeTeamId
      ? {
          id: row.assigneeTeamId,
          name: row.assigneeTeamName ?? '—',
          initials: initialsFromName(row.assigneeTeamName ?? ''),
        }
      : UNASSIGNED_HANDLER,
    jurisdiction,
  };
}

function registrationToClientLaw(reg: ClientRegistrationRecord): ClientLaw {
  // Per-registration handler / cadence are no longer carried on the table —
  // assignment lives on filings via the law-handler resolver, and cadence
  // lives on the law itself. The Laws tab shows assignment/cadence for each
  // registered law via other surfaces; this row falls back to "Unassigned".
  const handler: Handler = UNASSIGNED_HANDLER;

  // `lawJurisdiction` is text on the laws table (no enum guarantee). Coerce
  // to the front-end's narrow union; anything else (or null) defaults to
  // 'central'.
  const jurisdiction: ClientLaw['jurisdiction'] =
    reg.lawJurisdiction === 'state' ? 'state' : 'central';

  return {
    id: reg.id,
    lawId: reg.lawId,
    clientId: reg.clientId,
    code: reg.lawCode ?? '',
    name: reg.lawName ?? '',
    jurisdiction,
    cadence: '—',
    nextDue: '',
    openFilings: 0,
    overdueFilings: 0,
    onTimePct: 0,
    handler,
    registeredAt: reg.registeredAt ?? '',
    deactivatedAt: typeof reg.deactivatedAt === 'string' ? reg.deactivatedAt : null,
  };
}

export interface BuildClientDetailInput {
  record: ClientRecord;
  summary: FilingsSummary;
  /** Top-N preview from `useClientRegistrationsSummary`. */
  registrations: ClientRegistrationRecord[];
  /**
   * Server-reported total registrations for the client, sourced from
   * `meta.total` of the same summary query. Used for the
   * `registeredLaws` count so the UI never reflects the (capped)
   * preview length.
   */
  registrationsTotal: number;
  recentFilings: FilingListRow[];
  contacts: ClientContactRecord[];
}

/**
 * Compose a `ClientDetail` from real API data sources. Each panel of the
 * client detail page has its own independent query (client record, summary,
 * registrations, filings, contacts); this function joins them into the
 * ClientDetail shape the existing components consume. Replaces the
 * mergeClientDetail() + placeholder pattern.
 */
export function buildClientDetail(input: BuildClientDetailInput): ClientDetail {
  const { record, summary, registrations, registrationsTotal, recentFilings, contacts } = input;
  const risk: ClientRiskLevel = summary.overdue > 5 ? 'critical' : summary.overdue > 0 ? 'at-risk' : 'healthy';
  const onTimePct = summary.completed + summary.cancelled > 0
    ? Math.round((summary.completed / (summary.completed + summary.cancelled + summary.overdue)) * 100)
    : 0;

  const primary = contacts.find((c) => c.complianceIsPrimary) ?? contacts[0];
  const secondary = contacts.find((c) => !c.complianceIsPrimary && c !== primary);

  return {
    id: record.id,
    name: record.name,
    legalName: record.legalName ?? '',
    taxIdentifier: record.taxId ?? '',
    initials: initialsFromName(record.name),
    color: colorForClient(record.id, record.name),
    status: normalizeStatus(record.complianceStatus),
    risk,
    registeredLaws: registrationsTotal,
    openFilings: summary.overdue + summary.dueToday + summary.dueThisWeek + summary.upcoming,
    overdueFilings: summary.overdue,
    onTimePct,
    primaryHandler: UNASSIGNED_HANDLER,
    primaryContactEmail: primary?.primaryEmail ?? record.email ?? '',
    onboardedDate: record.complianceOnboardedAt ? record.complianceOnboardedAt.slice(0, 10) : '',
    lastFilingDate: '',
    primaryContact: primary
      ? contactToShape(primary)
      : { name: '—', email: record.email ?? '—', phone: record.phone ?? '—', designation: '—' },
    secondaryContact: secondary ? contactToShape(secondary) : undefined,
    address: formatAddress(record),
    industry: record.industry ?? '—',
    registeredLawDetails: registrations.map(registrationToClientLaw),
    recentFilings: recentFilings.map(filingRowToClientFiling),
    recentActivity: [],
    totalFilings: summary.total,
    filedThisMonth: summary.completed,
    filedOnTime: summary.completed,
  };
}
