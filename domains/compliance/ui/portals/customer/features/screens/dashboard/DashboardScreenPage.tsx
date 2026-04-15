import { useMemo, useState } from 'react';
import {
  Search,
  Command as CommandIcon,
  Plus,
  AlertTriangle,
  Moon,
  Sun,
} from 'lucide-react';
import {
  MetricKPI,
  DataTable,
  UrgencyBadge,
  JurisdictionTag,
  OrdinalDate,
  Button,
  type DataTableColumn,
} from '@packages/ui';
import {
  ComplianceCalendar,
  HandlerWorkloadList,
  type Filing,
} from '../../../../../shared';
import {
  PREVIEW_TODAY,
  MOCK_FILINGS,
  MOCK_WORKLOADS,
} from '../../console-preview/mockData';
import { DASHBOARD_ACTIVITY, type ActivityEvent } from './dashboardMock';

// Filings assigned to the current partner (Deepak Iyer — "DI") in v1 mock.
// In a wired version this comes from /me + /filings?assignee=me.
const MY_HANDLER_ID = 'h4';

const DASHBOARD_COLUMNS: DataTableColumn<Filing>[] = [
  {
    key: 'status',
    header: 'Status',
    width: '150px',
    cell: (f) => <UrgencyBadge urgency={f.status} />,
  },
  {
    key: 'client',
    header: 'Client',
    cell: (f) => (
      <div className="flex flex-col">
        <span className="text-ink font-sans">{f.clientName}</span>
        <span className="font-serif italic text-[11px] text-ink-muted">{f.periodLabel}</span>
      </div>
    ),
  },
  {
    key: 'law',
    header: 'Law',
    cell: (f) => (
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] text-ink-muted tracking-tabular uppercase">
          {f.lawCode}
        </span>
        <JurisdictionTag jurisdiction={f.jurisdiction} />
      </div>
    ),
  },
  {
    key: 'due',
    header: 'Due',
    width: '120px',
    cell: (f) => <OrdinalDate date={f.dueDate} variant="short" className="text-sm" />,
  },
];

function ActivityItem({ event }: { event: ActivityEvent }) {
  return (
    <li className="flex gap-3 py-3 border-b border-rule last:border-0">
      <span
        aria-hidden
        className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-[10px] font-sans font-semibold bg-authority text-paper-raised"
      >
        {event.actor.initials}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-ink leading-snug">
          <span className="font-sans font-medium">{event.actor.name}</span>{' '}
          <span className="text-ink-soft">{event.action}</span>{' '}
          <span className="font-sans">{event.target}</span>
          {event.context && (
            <span className="font-serif italic text-ink-muted"> — {event.context}</span>
          )}
        </p>
        <p className="mt-0.5 text-[10px] uppercase tracking-eyebrow text-ink-muted font-sans">
          {event.at}
        </p>
      </div>
    </li>
  );
}

export function DashboardScreenPage() {
  const [isDark, setIsDark] = useState(false);

  const toggleDark = () => {
    setIsDark((prev) => {
      const next = !prev;
      if (typeof document !== 'undefined') {
        document.body.classList.toggle('dark', next);
      }
      return next;
    });
  };

  // "Filings that need *my* action" — assigned to me and not yet filed,
  // sorted by dueDate ascending. In a wired version this is a query.
  const myFilings = useMemo(() => {
    return MOCK_FILINGS.filter(
      (f) => f.handler?.id === MY_HANDLER_ID && f.status !== 'filed',
    )
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 8);
  }, []);

  // If the partner has no assigned filings in mock data, fall back to the
  // overdue + due-today pile so the screen still has density.
  const workQueue = myFilings.length > 0
    ? myFilings
    : MOCK_FILINGS.filter((f) => f.status === 'overdue' || f.status === 'due-today').slice(0, 8);

  const overdueCount = MOCK_FILINGS.filter((f) => f.status === 'overdue').length;

  const formattedToday = PREVIEW_TODAY.toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-paper paper-grain">
      {/* ─── Top chrome ─────────────────────────────────────────────────── */}
      <div className="border-b border-rule bg-paper-raised">
        <div className="max-w-[1480px] mx-auto px-10 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-serif text-2xl italic text-ink leading-none">
              Compliance<span className="text-signal">.</span>
            </span>
            <nav className="flex items-center gap-6 text-[11px] uppercase tracking-eyebrow font-sans font-medium text-ink-soft">
              <a className="text-ink border-b border-ink pb-0.5">Dashboard</a>
              <a className="hover:text-ink">Clients</a>
              <a className="hover:text-ink">Laws</a>
              <a className="hover:text-ink">Filings</a>
              <a className="hover:text-ink">Reports</a>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="flex items-center gap-2 px-3 py-1.5 border border-rule hover:border-ink text-[11px] text-ink-muted hover:text-ink font-sans transition-colors"
            >
              <Search className="w-3 h-3" strokeWidth={1.5} />
              <span>Search or command</span>
              <span className="ml-4 flex items-center gap-0.5 font-mono text-[10px] text-ink-muted/80">
                <CommandIcon className="w-3 h-3" strokeWidth={1.5} />K
              </span>
            </button>
            <button
              type="button"
              onClick={toggleDark}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="flex items-center justify-center w-8 h-8 border border-rule hover:border-ink text-ink-muted hover:text-ink transition-colors"
            >
              {isDark ? <Sun className="w-3.5 h-3.5" strokeWidth={1.5} /> : <Moon className="w-3.5 h-3.5" strokeWidth={1.5} />}
            </button>
            <div className="flex items-center gap-2 pl-4 border-l border-rule">
              <span
                aria-hidden
                className="w-7 h-7 bg-authority text-paper-raised text-[10px] font-sans font-semibold flex items-center justify-center"
              >
                DI
              </span>
              <div className="text-right">
                <div className="text-xs text-ink font-sans leading-none">Deepak Iyer</div>
                <div className="text-[10px] uppercase tracking-eyebrow text-ink-muted font-sans mt-0.5">
                  Partner
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-[1480px] mx-auto px-10 py-8">
        {/* ─── Page header ──────────────────────────────────────────────── */}
        <header className="flex items-end justify-between mb-8">
          <div>
            <p className="text-[11px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted">
              Partner Desk
            </p>
            <h1 className="font-serif text-4xl text-ink leading-none mt-1">Dashboard</h1>
            <p className="mt-2 font-serif italic text-ink-soft">{formattedToday}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              Export
            </Button>
            <Button size="sm">
              <Plus className="w-3.5 h-3.5 mr-1.5" strokeWidth={2} />
              New filing
            </Button>
          </div>
        </header>

        {/* ─── Alert strip (shows only when there's something to flag) ─── */}
        {overdueCount > 0 && (
          <div className="mb-6 border border-signal/40 bg-signal/5 px-5 py-3 flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-signal flex-shrink-0" strokeWidth={2} />
            <p className="flex-1 text-sm text-ink">
              <span className="font-sans font-medium">{overdueCount} filings are past due.</span>{' '}
              <span className="text-ink-soft">Review and reassign before end of day.</span>
            </p>
            <button
              type="button"
              className="text-[11px] uppercase tracking-eyebrow font-sans font-medium text-signal hover:underline"
            >
              Review →
            </button>
          </div>
        )}

        {/* ─── KPI row ──────────────────────────────────────────────────── */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-rule border border-rule">
          <MetricKPI
            label="Overdue"
            value="12"
            unit="filings"
            delta="▲ 3 since yesterday"
            deltaTone="negative"
            accent="signal"
            sparklineData={[4, 6, 5, 9, 8, 11, 12]}
            sparklineTone="signal"
            footnote="across 9 clients"
            index={0}
          />
          <MetricKPI
            label="Due today"
            value="8"
            unit="filings"
            delta="— no change"
            deltaTone="neutral"
            accent="due-soon"
            sparklineData={[6, 7, 5, 8, 8, 9, 8]}
            sparklineTone="due-soon"
            footnote="5 in GST desk"
            index={1}
          />
          <MetricKPI
            label="Due this week"
            value="28"
            unit="filings"
            delta="▲ 4 since Monday"
            deltaTone="neutral"
            accent="authority"
            sparklineData={[22, 19, 25, 27, 30, 28, 28]}
            sparklineTone="authority"
            footnote="across 24 clients"
            index={2}
          />
          <MetricKPI
            label="Filed this month"
            value="142"
            unit=""
            delta="▲ 12 vs last month"
            deltaTone="positive"
            accent="filed"
            sparklineData={[98, 110, 118, 125, 132, 138, 142]}
            sparklineTone="filed"
            footnote="68% of target"
            index={3}
          />
        </section>

        {/* ─── Main grid: my work + calendar ─────────────────────────────── */}
        <section className="mt-8 grid grid-cols-12 gap-6">
          <div className="col-span-12 xl:col-span-8">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="font-serif text-xl text-ink leading-none">Your open work</h2>
              <a className="text-[11px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted hover:text-ink">
                View all {MOCK_FILINGS.length} filings →
              </a>
            </div>
            <div className="bg-paper-raised border border-rule">
              <DataTable
                columns={DASHBOARD_COLUMNS}
                rows={workQueue}
                getRowKey={(f) => f.id}
                onRowClick={() => {}}
              />
            </div>
          </div>
          <div className="col-span-12 xl:col-span-4">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="font-serif text-xl text-ink leading-none">April calendar</h2>
              <a className="text-[11px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted hover:text-ink">
                Full calendar →
              </a>
            </div>
            <ComplianceCalendar filings={MOCK_FILINGS} month={PREVIEW_TODAY} />
          </div>
        </section>

        {/* ─── Second row: activity + team workload ──────────────────────── */}
        <section className="mt-10 grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-5">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="font-serif text-xl text-ink leading-none">Recent activity</h2>
              <a className="text-[11px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted hover:text-ink">
                Audit trail →
              </a>
            </div>
            <div className="bg-paper-raised border border-rule px-5">
              <ul>
                {DASHBOARD_ACTIVITY.map((event) => (
                  <ActivityItem key={event.id} event={event} />
                ))}
              </ul>
            </div>
          </div>
          <div className="col-span-12 lg:col-span-7">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="font-serif text-xl text-ink leading-none">Team workload</h2>
              <a className="text-[11px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted hover:text-ink">
                Rebalance →
              </a>
            </div>
            <HandlerWorkloadList workloads={MOCK_WORKLOADS} />
          </div>
        </section>
      </main>
    </div>
  );
}
