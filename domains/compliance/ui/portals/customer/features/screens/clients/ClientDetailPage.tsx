import { useState } from 'react';
import { Link } from 'react-router';
import {
  ChevronRight,
  ChevronLeft,
  Mail,
  Phone,
  MapPin,
  Building2,
  Calendar,
  FileText,
  AlertTriangle,
  UserPlus,
  GitBranch,
  MessageSquare,
  Plus,
} from 'lucide-react';
import {
  DataTable,
  Pagination,
  OrdinalDate,
  CoarseTabs,
  type DataTableColumn,
} from '@packages/ui';
import type { Handler } from '../../../../../shared/types';
import {
  MOCK_CLIENT_DETAIL,
  type ClientFiling,
  type ClientLaw,
  type ClientActivity,
  type ClientFilingStatus,
} from './clientDetailMock';
import { ScreenPreviewTopBar } from '../shared/ScreenPreviewTopBar';

// ─── Status helpers ────────────────────────────────────────────────

const STATUS_LABEL: Record<ClientFilingStatus, string> = {
  overdue: 'Overdue',
  'due-today': 'Due today',
  'due-this-week': 'Due this week',
  upcoming: 'Upcoming',
  filed: 'Filed',
};

const STATUS_TONE: Record<ClientFilingStatus, string> = {
  overdue: 'bg-signal text-signal',
  'due-today': 'bg-signal text-signal',
  'due-this-week': 'bg-due-soon text-due-soon',
  upcoming: 'bg-ink-muted text-ink-muted',
  filed: 'bg-filed text-filed',
};

const RISK_LABEL: Record<string, string> = {
  healthy: 'Healthy',
  'at-risk': 'At risk',
  critical: 'Critical',
};

const RISK_TONE: Record<string, string> = {
  healthy: 'bg-filed',
  'at-risk': 'bg-due-soon',
  critical: 'bg-signal',
};

const JURISDICTION_LABEL: Record<string, string> = {
  central: 'Central',
  state: 'State',
  municipal: 'Municipal',
  international: 'Int\'l',
};

// ─── Activity icon map ─────────────────────────────────────────────

const ACTIVITY_ICON: Record<ClientActivity['type'], typeof FileText> = {
  'filing-submitted': FileText,
  'handler-changed': UserPlus,
  'note-added': MessageSquare,
  'status-change': GitBranch,
  'law-added': Plus,
};

const ACTIVITY_TONE: Record<ClientActivity['type'], string> = {
  'filing-submitted': 'bg-filed text-paper-raised',
  'handler-changed': 'bg-authority text-paper-raised',
  'note-added': 'bg-ink-muted text-paper-raised',
  'status-change': 'bg-due-soon text-paper-raised',
  'law-added': 'bg-authority text-paper-raised',
};

// ─── Sub-components ────────────────────────────────────────────────

function StatusBadge({ status }: { status: ClientFilingStatus }) {
  const tone = STATUS_TONE[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-[2px] border border-rule text-[10px] font-sans font-semibold uppercase tracking-[0.12em] bg-paper-raised`}
    >
      <span className={`w-1.5 h-1.5 flex-none ${tone.split(' ')[0]}`} aria-hidden />
      <span className="text-ink-soft">{STATUS_LABEL[status]}</span>
    </span>
  );
}

function JurisdictionTag({ jurisdiction }: { jurisdiction: string }) {
  return (
    <span className="inline-block px-1.5 py-[1px] border border-rule text-[9px] font-sans font-semibold uppercase tracking-[0.14em] text-ink-muted bg-paper-raised">
      {JURISDICTION_LABEL[jurisdiction] ?? jurisdiction}
    </span>
  );
}

function HealthBar({ pct }: { pct: number }) {
  const tone =
    pct >= 95 ? 'bg-filed' : pct >= 85 ? 'bg-authority' : pct >= 75 ? 'bg-due-soon' : 'bg-signal';
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-1 bg-rule">
        <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-[11px] tabular-nums text-ink-soft w-7 text-right">
        {pct}%
      </span>
    </div>
  );
}

function HandlerPill({ handler }: { handler: Handler }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span
        aria-hidden
        className="w-6 h-6 flex-none bg-authority text-paper-raised text-[10px] font-sans font-semibold flex items-center justify-center"
      >
        {handler.initials}
      </span>
      <span className="text-[11px] font-sans text-ink-soft truncate">
        {handler.name.split(' ')[0]}
      </span>
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-rule last:border-b-0">
      <span className="text-[11px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted w-28 flex-none pt-0.5">
        {label}
      </span>
      <div className="text-sm text-ink font-sans">{children}</div>
    </div>
  );
}

// ─── Filings table columns ─────────────────────────────────────────

const FILING_COLUMNS: DataTableColumn<ClientFiling>[] = [
  {
    key: 'lawCode',
    header: 'Filing',
    cell: (f) => (
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-medium text-ink tracking-wide">{f.lawCode}</span>
          <JurisdictionTag jurisdiction={f.jurisdiction} />
        </div>
        <span className="text-[11px] font-sans text-ink-muted mt-0.5 block truncate">
          {f.ruleName}
        </span>
      </div>
    ),
  },
  {
    key: 'period',
    header: 'Period',
    width: '100px',
    cell: (f) => (
      <span className="font-mono text-[11px] text-ink-soft">{f.period}</span>
    ),
  },
  {
    key: 'dueDate',
    header: 'Due',
    width: '100px',
    cell: (f) => <OrdinalDate date={f.dueDate} variant="short" className="text-[11px]" />,
  },
  {
    key: 'filedDate',
    header: 'Filed',
    width: '100px',
    cell: (f) =>
      f.filedDate ? (
        <OrdinalDate date={f.filedDate} variant="short" className="text-[11px]" />
      ) : (
        <span className="text-ink-muted text-[11px]">—</span>
      ),
  },
  {
    key: 'status',
    header: 'Status',
    width: '120px',
    cell: (f) => <StatusBadge status={f.status} />,
  },
  {
    key: 'priority',
    header: 'Priority',
    width: '90px',
    cell: (f) => (
      <span
        className={`text-[11px] font-sans font-semibold uppercase tracking-eyebrow ${
          f.priority === 'critical'
            ? 'text-signal'
            : f.priority === 'high'
              ? 'text-due-soon'
              : 'text-ink-muted'
        }`}
      >
        {f.priority}
      </span>
    ),
  },
  {
    key: 'handler',
    header: 'Handler',
    width: '110px',
    cell: (f) => <HandlerPill handler={f.handler} />,
  },
];

// ─── Laws table columns ────────────────────────────────────────────

const LAW_COLUMNS: DataTableColumn<ClientLaw>[] = [
  {
    key: 'code',
    header: 'Law',
    cell: (l) => (
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-medium text-ink tracking-wide">{l.code}</span>
          <JurisdictionTag jurisdiction={l.jurisdiction} />
        </div>
        <span className="text-[11px] font-sans text-ink-muted mt-0.5 block truncate">
          {l.name}
        </span>
      </div>
    ),
  },
  {
    key: 'cadence',
    header: 'Cadence',
    width: '100px',
    cell: (l) => (
      <span className="text-[11px] font-sans text-ink-soft uppercase tracking-eyebrow font-medium">
        {l.cadence}
      </span>
    ),
  },
  {
    key: 'nextDue',
    header: 'Next due',
    width: '100px',
    cell: (l) => <OrdinalDate date={l.nextDue} variant="short" className="text-[11px]" />,
  },
  {
    key: 'openFilings',
    header: 'Open',
    width: '70px',
    align: 'right',
    cell: (l) => (
      <span className="font-mono text-sm tabular-nums text-ink">{l.openFilings}</span>
    ),
  },
  {
    key: 'overdueFilings',
    header: 'Overdue',
    width: '80px',
    align: 'right',
    cell: (l) => (
      <span
        className={`font-mono text-sm tabular-nums ${l.overdueFilings > 0 ? 'text-signal font-medium' : 'text-ink-muted'}`}
      >
        {l.overdueFilings || '—'}
      </span>
    ),
  },
  {
    key: 'onTimePct',
    header: 'On-time rate',
    width: '140px',
    cell: (l) => <HealthBar pct={l.onTimePct} />,
  },
  {
    key: 'handler',
    header: 'Handler',
    width: '110px',
    cell: (l) => <HandlerPill handler={l.handler} />,
  },
  {
    key: 'registeredAt',
    header: 'Since',
    width: '100px',
    cell: (l) => <OrdinalDate date={l.registeredAt} variant="short" className="text-[11px]" />,
  },
];

// ─── Tabs ──────────────────────────────────────────────────────────

type DetailTab = 'overview' | 'filings' | 'laws';

// ─── Page ──────────────────────────────────────────────────────────

export function ClientDetailPage() {
  const client = MOCK_CLIENT_DETAIL;

  const [activeTab, setActiveTab] = useState<DetailTab>('overview');

  // Filings pagination
  const [filingsPage, setFilingsPage] = useState(1);
  const [filingsPageSize, setFilingsPageSize] = useState(10);
  const filingsPageCount = Math.max(1, Math.ceil(client.recentFilings.length / filingsPageSize));
  const paginatedFilings = client.recentFilings.slice(
    (filingsPage - 1) * filingsPageSize,
    filingsPage * filingsPageSize,
  );

  // Filing tab sub-filter
  const [filingStatusTab, setFilingStatusTab] = useState<'all' | ClientFilingStatus>('all');
  const filteredFilings =
    filingStatusTab === 'all'
      ? paginatedFilings
      : client.recentFilings.filter((f) => f.status === filingStatusTab);


  const filingStatusTabs = [
    { value: 'all' as const, label: 'All', count: client.recentFilings.length },
    {
      value: 'overdue' as const,
      label: 'Overdue',
      count: client.recentFilings.filter((f) => f.status === 'overdue').length,
    },
    {
      value: 'due-today' as const,
      label: 'Due today',
      count: client.recentFilings.filter((f) => f.status === 'due-today').length,
    },
    {
      value: 'upcoming' as const,
      label: 'Upcoming',
      count: client.recentFilings.filter((f) => f.status === 'upcoming').length,
    },
    {
      value: 'filed' as const,
      label: 'Filed',
      count: client.recentFilings.filter((f) => f.status === 'filed').length,
    },
  ];

  const detailTabs = [
    { value: 'overview' as const, label: 'Overview' },
    { value: 'filings' as const, label: 'Filings', count: client.openFilings },
    { value: 'laws' as const, label: 'Laws', count: client.registeredLaws },
  ];

  return (
    <div className="min-h-screen bg-paper paper-grain">
      <ScreenPreviewTopBar active="clients" />

      <main className="max-w-[1480px] mx-auto px-10 py-8">
        {/* ─── Breadcrumb + back ────────────────────────────────────────── */}
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted mb-6">
          <Link to="/screens/clients" className="flex items-center gap-1 hover:text-ink transition-colors">
            <ChevronLeft className="w-3 h-3" strokeWidth={1.5} />
            <span>Clients</span>
          </Link>
          <ChevronRight className="w-3 h-3" strokeWidth={1.5} />
          <span className="text-ink">{client.name}</span>
        </div>

        {/* ─── Client header card ───────────────────────────────────────── */}
        <div className="border border-rule bg-paper-raised p-6 mb-6">
          <div className="flex items-start gap-5">
            <span
              aria-hidden
              className="w-14 h-14 flex-none flex items-center justify-center text-lg font-sans font-semibold text-paper-raised"
              style={{ backgroundColor: client.color }}
            >
              {client.initials}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <h1 className="font-serif text-3xl text-ink leading-none">{client.name}</h1>
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-[2px] border border-rule text-[10px] font-sans font-semibold uppercase tracking-[0.12em] bg-paper-raised`}
                >
                  <span className={`w-1.5 h-1.5 flex-none ${RISK_TONE[client.risk]}`} aria-hidden />
                  <span className="text-ink-soft">{RISK_LABEL[client.risk]}</span>
                </span>
                <span className="inline-block px-2 py-[2px] border border-rule text-[10px] font-sans font-semibold uppercase tracking-[0.12em] text-ink-muted bg-paper-raised">
                  {client.status}
                </span>
              </div>
              <p className="font-serif italic text-ink-soft mt-1">{client.legalName}</p>
              <div className="flex items-center gap-6 mt-3">
                <span className="font-mono text-[11px] text-ink-muted tracking-wide">
                  {client.taxIdentifier}
                </span>
                <span className="text-[11px] text-ink-muted font-sans flex items-center gap-1">
                  <Building2 className="w-3 h-3" strokeWidth={1.5} />
                  {client.industry}
                </span>
                <span className="text-[11px] text-ink-muted font-sans flex items-center gap-1">
                  <Calendar className="w-3 h-3" strokeWidth={1.5} />
                  Since <OrdinalDate date={client.onboardedDate} variant="short" className="text-[11px] inline" />
                </span>
              </div>
            </div>

            {/* Quick stats */}
            <div className="flex-none flex gap-6 text-center">
              <div>
                <div className="font-mono text-2xl tabular-nums text-ink">{client.openFilings}</div>
                <div className="text-[10px] uppercase tracking-eyebrow font-sans text-ink-muted mt-0.5">Open</div>
              </div>
              <div>
                <div className={`font-mono text-2xl tabular-nums ${client.overdueFilings > 0 ? 'text-signal' : 'text-ink'}`}>
                  {client.overdueFilings}
                </div>
                <div className="text-[10px] uppercase tracking-eyebrow font-sans text-ink-muted mt-0.5">Overdue</div>
              </div>
              <div>
                <div className="font-mono text-2xl tabular-nums text-ink">{client.onTimePct}%</div>
                <div className="text-[10px] uppercase tracking-eyebrow font-sans text-ink-muted mt-0.5">On-time</div>
              </div>
              <div>
                <div className="font-mono text-2xl tabular-nums text-ink">{client.registeredLaws}</div>
                <div className="text-[10px] uppercase tracking-eyebrow font-sans text-ink-muted mt-0.5">Laws</div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Tabs ─────────────────────────────────────────────────────── */}
        <CoarseTabs
          variant="segmented"
          tabs={detailTabs}
          value={activeTab}
          onChange={setActiveTab}
        />

        {/* ─── Tab content ──────────────────────────────────────────────── */}
        <div className="mt-6">
          {activeTab === 'overview' && (
            <OverviewTab client={client} />
          )}

          {activeTab === 'filings' && (
            <div>
              <CoarseTabs
                variant="segmented"
                tabs={filingStatusTabs}
                value={filingStatusTab}
                onChange={setFilingStatusTab}
              />
              <div className="mt-4 bg-paper-raised border border-rule overflow-x-auto">
                <DataTable
                  columns={FILING_COLUMNS}
                  visibleColumns={FILING_COLUMNS.map((c) => c.key)}
                  rows={filingStatusTab === 'all' ? paginatedFilings : filteredFilings}
                  getRowKey={(f) => f.id}
                  onRowClick={() => {}}
                />
                {filingStatusTab === 'all' && (
                  <Pagination
                    page={filingsPage}
                    pageSize={filingsPageSize}
                    pageCount={filingsPageCount}
                    totalRows={client.recentFilings.length}
                    onPageChange={setFilingsPage}
                    onPageSizeChange={(size) => {
                      setFilingsPageSize(size);
                      setFilingsPage(1);
                    }}
                  />
                )}
              </div>
            </div>
          )}

          {activeTab === 'laws' && (
            <div className="bg-paper-raised border border-rule overflow-x-auto">
              <DataTable
                columns={LAW_COLUMNS}
                visibleColumns={LAW_COLUMNS.map((c) => c.key)}
                rows={client.registeredLawDetails}
                getRowKey={(l) => l.id}
                onRowClick={() => {}}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// ─── Overview tab ──────────────────────────────────────────────────

function OverviewTab({ client }: { client: typeof MOCK_CLIENT_DETAIL }) {
  return (
    <div className="grid grid-cols-[1fr_340px] gap-6">
      {/* Left column — details */}
      <div className="space-y-6">
        {/* Entity details */}
        <section className="border border-rule bg-paper-raised p-5">
          <h3 className="text-[11px] uppercase tracking-eyebrow font-sans font-semibold text-ink-muted mb-3">
            Entity details
          </h3>
          <InfoRow label="Legal name">{client.legalName}</InfoRow>
          <InfoRow label="Tax ID">
            <span className="font-mono text-[12px] tracking-wide">{client.taxIdentifier}</span>
          </InfoRow>
          <InfoRow label="Industry">{client.industry}</InfoRow>
          <InfoRow label="Address">
            <span className="flex items-start gap-1.5">
              <MapPin className="w-3 h-3 mt-0.5 flex-none text-ink-muted" strokeWidth={1.5} />
              {client.address}
            </span>
          </InfoRow>
          <InfoRow label="Handler">
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="w-6 h-6 flex-none bg-authority text-paper-raised text-[10px] font-sans font-semibold flex items-center justify-center"
              >
                {client.primaryHandler.initials}
              </span>
              <span className="text-sm text-ink">{client.primaryHandler.name}</span>
              {client.primaryHandler.role && (
                <span className="text-[11px] text-ink-muted">· {client.primaryHandler.role}</span>
              )}
            </div>
          </InfoRow>
          <InfoRow label="Onboarded">
            <OrdinalDate date={client.onboardedDate} variant="long" className="text-sm" />
          </InfoRow>
        </section>

        {/* Contact info */}
        <section className="border border-rule bg-paper-raised p-5">
          <h3 className="text-[11px] uppercase tracking-eyebrow font-sans font-semibold text-ink-muted mb-3">
            Contacts
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-sans font-medium text-ink">{client.primaryContact.name}</span>
                <span className="text-[10px] uppercase tracking-eyebrow font-sans text-ink-muted border border-rule px-1.5 py-[1px]">
                  Primary
                </span>
              </div>
              <p className="text-[11px] text-ink-muted font-sans mb-1.5">{client.primaryContact.designation}</p>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 text-[11px] text-ink-soft font-sans">
                  <Mail className="w-3 h-3" strokeWidth={1.5} />
                  {client.primaryContact.email}
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-ink-soft font-sans">
                  <Phone className="w-3 h-3" strokeWidth={1.5} />
                  {client.primaryContact.phone}
                </span>
              </div>
            </div>
            {client.secondaryContact && (
              <div className="pt-3 border-t border-rule">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-sans font-medium text-ink">{client.secondaryContact.name}</span>
                  <span className="text-[10px] uppercase tracking-eyebrow font-sans text-ink-muted border border-rule px-1.5 py-[1px]">
                    Secondary
                  </span>
                </div>
                <p className="text-[11px] text-ink-muted font-sans mb-1.5">{client.secondaryContact.designation}</p>
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5 text-[11px] text-ink-soft font-sans">
                    <Mail className="w-3 h-3" strokeWidth={1.5} />
                    {client.secondaryContact.email}
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] text-ink-soft font-sans">
                    <Phone className="w-3 h-3" strokeWidth={1.5} />
                    {client.secondaryContact.phone}
                  </span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Compliance snapshot */}
        <section className="border border-rule bg-paper-raised p-5">
          <h3 className="text-[11px] uppercase tracking-eyebrow font-sans font-semibold text-ink-muted mb-3">
            Compliance snapshot
          </h3>
          <div className="grid grid-cols-4 gap-px bg-rule">
            {[
              { label: 'Total filings', value: String(client.totalFilings) },
              { label: 'Filed on time', value: String(client.filedOnTime) },
              { label: 'Filed this month', value: String(client.filedThisMonth) },
              { label: 'On-time rate', value: `${client.onTimePct}%` },
            ].map((stat) => (
              <div key={stat.label} className="bg-paper-raised p-3 text-center">
                <div className="font-mono text-lg tabular-nums text-ink">{stat.value}</div>
                <div className="text-[10px] uppercase tracking-eyebrow font-sans text-ink-muted mt-0.5">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Right column — activity feed */}
      <div className="space-y-6">
        {/* Overdue alert */}
        {client.overdueFilings > 0 && (
          <div className="border border-signal/40 bg-signal/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-3.5 h-3.5 text-signal" strokeWidth={2} />
              <span className="text-[11px] uppercase tracking-eyebrow font-sans font-semibold text-signal">
                Action required
              </span>
            </div>
            <p className="text-sm text-ink font-sans">
              {client.overdueFilings} filing{client.overdueFilings !== 1 ? 's' : ''} overdue.
              Review and file immediately to avoid penalties.
            </p>
          </div>
        )}

        {/* Recent activity */}
        <section className="border border-rule bg-paper-raised p-5">
          <h3 className="text-[11px] uppercase tracking-eyebrow font-sans font-semibold text-ink-muted mb-4">
            Recent activity
          </h3>
          <div className="space-y-0">
            {client.recentActivity.map((event, idx) => {
              const Icon = ACTIVITY_ICON[event.type];
              const isLast = idx === client.recentActivity.length - 1;
              return (
                <div key={event.id} className="flex gap-3">
                  {/* Timeline line + icon */}
                  <div className="flex flex-col items-center">
                    <span
                      className={`w-6 h-6 flex-none flex items-center justify-center ${ACTIVITY_TONE[event.type]}`}
                    >
                      <Icon className="w-3 h-3" strokeWidth={2} />
                    </span>
                    {!isLast && <div className="w-px flex-1 bg-rule" />}
                  </div>
                  {/* Content */}
                  <div className={`pb-4 min-w-0 ${isLast ? '' : ''}`}>
                    <p className="text-sm text-ink font-sans leading-snug">{event.detail}</p>
                    <p className="text-[11px] text-ink-muted font-sans mt-0.5">
                      {event.actor.name} · {formatRelativeTime(event.timestamp)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Quick links */}
        <section className="border border-rule bg-paper-raised p-5">
          <h3 className="text-[11px] uppercase tracking-eyebrow font-sans font-semibold text-ink-muted mb-3">
            Quick actions
          </h3>
          <div className="space-y-2">
            {[
              { label: 'View all filings', icon: FileText },
              { label: 'Add law registration', icon: Plus },
              { label: 'Change handler', icon: UserPlus },
            ].map((action) => (
              <button
                key={action.label}
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2 text-sm font-sans text-ink-soft hover:text-ink hover:bg-paper border border-transparent hover:border-rule transition-colors text-left"
              >
                <action.icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                {action.label}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────

function formatRelativeTime(isoDate: string): string {
  const diff = new Date('2026-04-15T12:00:00Z').getTime() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}
