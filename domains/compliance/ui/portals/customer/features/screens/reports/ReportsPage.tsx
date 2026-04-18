import { useState, useMemo } from 'react';
import { startOfMonth, subMonths } from 'date-fns';
import {
  ChevronRight,
  Download,
  TrendingUp,
  Clock,
  Users,
  AlertTriangle,
} from 'lucide-react';
import {
  DataGridShell,
  Button,
  CoarseTabs,
  Eyebrow,
  SearchInput,
  type DataTableColumn,
} from '@packages/ui';
import { OrdinalDate } from '../../../../../components';
import { DateRangePopover, type DateRangeValue } from '../../../../../shared';
import { ScreenPreviewTopBar } from '../shared/ScreenPreviewTopBar';
import {
  COMPLIANCE_TREND,
  COMPLIANCE_ROWS,
  AGING_BUCKETS,
  OVERDUE_ROWS,
  WORKLOAD_ROWS,
  type ReportTab,
  type ComplianceRow,
  type OverdueRow,
  type WorkloadRow,
} from './reportsMock';

const TODAY = new Date('2026-04-17');
const DEFAULT_RANGE: DateRangeValue = {
  from: startOfMonth(subMonths(TODAY, 5)),
  to: TODAY,
};

// ─── Bar chart helpers ──────────────────────────────────────────────

function StackedBarChart({
  data,
}: {
  data: { month: string; onTime: number; late: number; overdue: number }[];
}) {
  const maxVal = Math.max(...data.map((d) => d.onTime + d.late + d.overdue));
  const barH = 140;

  return (
    <div className="flex items-end justify-center gap-6 h-[180px] px-2">
      {data.map((d) => {
        const total = d.onTime + d.late + d.overdue;
        const scale = total / maxVal;
        const onTimeH = (d.onTime / total) * barH * scale;
        const lateH = (d.late / total) * barH * scale;
        const overdueH = (d.overdue / total) * barH * scale;

        return (
          <div key={d.month} className="flex flex-col items-center gap-1">
            <div className="w-10 flex flex-col justify-end" style={{ height: barH }}>
              <div className="w-full bg-signal" style={{ height: overdueH }} />
              <div className="w-full bg-due-soon" style={{ height: lateH }} />
              <div className="w-full bg-filed" style={{ height: onTimeH }} />
            </div>
            <span className="text-[10px] font-mono uppercase tracking-wide text-ink-muted text-center">
              {d.month}
            </span>
            <span className="text-[10px] font-mono tabular-nums text-ink-soft text-center">{total}</span>
          </div>
        );
      })}
    </div>
  );
}

function AgingBarChart({ buckets }: { buckets: typeof AGING_BUCKETS }) {
  const maxCount = Math.max(...buckets.map((b) => b.count));

  return (
    <div className="space-y-3 px-2">
      {buckets.map((b) => {
        const pct = (b.count / maxCount) * 100;
        const bg =
          b.tone === 'due-soon' ? 'bg-due-soon' : 'bg-signal';

        return (
          <div key={b.range} className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-ink-soft w-[72px] text-right shrink-0">
              {b.label}
            </span>
            <div className="flex-1 h-5 bg-rule/50">
              <div className={`h-full ${bg}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-sm font-mono tabular-nums text-ink font-medium w-6 text-right">
              {b.count}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function WorkloadBarChart({ rows }: { rows: WorkloadRow[] }) {
  const maxAssigned = Math.max(...rows.map((r) => r.totalAssigned));

  return (
    <div className="space-y-2 px-2">
      {rows.map((r) => {
        const completedW = (r.completed / maxAssigned) * 100;
        const inProgressW = (r.inProgress / maxAssigned) * 100;
        const overdueW = (r.overdue / maxAssigned) * 100;

        return (
          <div key={r.id} className="flex items-center gap-3">
            <div className="flex items-center gap-2 w-[100px] shrink-0">
              <span
                aria-hidden
                className="w-5 h-5 flex-none flex items-center justify-center text-[8px] font-sans font-semibold text-paper-raised"
                style={{ backgroundColor: r.color }}
              >
                {r.initials}
              </span>
              <span className="text-[11px] font-sans text-ink truncate">{r.name.split(' ')[0]}</span>
            </div>
            <div className="flex-1 flex h-4 bg-rule/30">
              <div className="h-full bg-filed" style={{ width: `${completedW}%` }} />
              <div className="h-full bg-authority" style={{ width: `${inProgressW}%` }} />
              {r.overdue > 0 && (
                <div className="h-full bg-signal" style={{ width: `${overdueW}%` }} />
              )}
            </div>
            <span className="text-[11px] font-mono tabular-nums text-ink-soft w-6 text-right">
              {r.totalAssigned}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Health bar ─────────────────────────────────────────────────────

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

function PriorityPill({ priority }: { priority: OverdueRow['priority'] }) {
  const tone =
    priority === 'critical'
      ? 'bg-signal text-signal'
      : priority === 'high'
        ? 'bg-due-soon text-due-soon'
        : 'bg-ink-muted text-ink-muted';
  const label = priority.charAt(0).toUpperCase() + priority.slice(1);

  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-[2px] border border-rule text-[10px] font-sans font-semibold uppercase tracking-[0.12em] bg-paper-raised">
      <span className={`w-1.5 h-1.5 flex-none ${tone.split(' ')[0]}`} aria-hidden />
      <span className="text-ink-soft">{label}</span>
    </span>
  );
}

// ─── Table columns ──────────────────────────────────────────────────

const COMPLIANCE_COLUMNS: DataTableColumn<ComplianceRow>[] = [
  {
    key: 'client',
    header: 'Client',
    cell: (r) => (
      <div className="flex items-center gap-3 min-w-0">
        <span
          aria-hidden
          className="w-7 h-7 flex-none flex items-center justify-center text-[9px] font-sans font-semibold text-paper-raised"
          style={{ backgroundColor: r.color }}
        >
          {r.initials}
        </span>
        <span className="text-sm text-ink font-sans truncate">{r.clientName}</span>
      </div>
    ),
  },
  {
    key: 'totalFilings',
    header: 'Total',
    width: '80px',
    align: 'right',
    cell: (r) => <span className="font-mono text-sm tabular-nums text-ink">{r.totalFilings}</span>,
  },
  {
    key: 'onTime',
    header: 'On time',
    width: '80px',
    align: 'right',
    cell: (r) => <span className="font-mono text-sm tabular-nums text-filed">{r.onTime}</span>,
  },
  {
    key: 'late',
    header: 'Late',
    width: '80px',
    align: 'right',
    cell: (r) => (
      <span className={`font-mono text-sm tabular-nums ${r.late > 0 ? 'text-due-soon' : 'text-ink-muted'}`}>
        {r.late || '—'}
      </span>
    ),
  },
  {
    key: 'overdue',
    header: 'Overdue',
    width: '80px',
    align: 'right',
    cell: (r) => (
      <span className={`font-mono text-sm tabular-nums ${r.overdue > 0 ? 'text-signal font-medium' : 'text-ink-muted'}`}>
        {r.overdue || '—'}
      </span>
    ),
  },
  {
    key: 'onTimeRate',
    header: 'On-time rate',
    width: '150px',
    cell: (r) => <HealthBar pct={r.onTimeRate} />,
  },
];

const OVERDUE_COLUMNS: DataTableColumn<OverdueRow>[] = [
  {
    key: 'priority',
    header: 'Priority',
    width: '100px',
    cell: (r) => <PriorityPill priority={r.priority} />,
  },
  {
    key: 'filing',
    header: 'Filing',
    cell: (r) => (
      <div className="min-w-0">
        <span className="text-sm text-ink font-sans truncate block">{r.filingName}</span>
        <span className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">{r.lawCode}</span>
      </div>
    ),
  },
  {
    key: 'client',
    header: 'Client',
    width: '180px',
    cell: (r) => (
      <div className="flex items-center gap-2 min-w-0">
        <span
          aria-hidden
          className="w-6 h-6 flex-none flex items-center justify-center text-[9px] font-sans font-semibold text-paper-raised"
          style={{ backgroundColor: r.clientColor }}
        >
          {r.clientInitials}
        </span>
        <span className="text-sm text-ink font-sans truncate">{r.clientName}</span>
      </div>
    ),
  },
  {
    key: 'dueDate',
    header: 'Due date',
    width: '110px',
    cell: (r) => <OrdinalDate date={r.dueDate} variant="short" className="text-[11px]" />,
  },
  {
    key: 'daysOverdue',
    header: 'Days overdue',
    width: '110px',
    align: 'right',
    cell: (r) => {
      const tone = r.daysOverdue > 15 ? 'text-signal font-medium' : r.daysOverdue > 7 ? 'text-due-soon' : 'text-ink';
      return <span className={`font-mono text-sm tabular-nums ${tone}`}>{r.daysOverdue}d</span>;
    },
  },
  {
    key: 'handler',
    header: 'Handler',
    width: '120px',
    cell: (r) => (
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="w-5 h-5 flex-none bg-authority text-paper-raised text-[9px] font-sans font-semibold flex items-center justify-center"
        >
          {r.handlerInitials}
        </span>
        <span className="text-[11px] font-sans text-ink-soft truncate">{r.handler.split(' ')[0]}</span>
      </div>
    ),
  },
];

const WORKLOAD_COLUMNS: DataTableColumn<WorkloadRow>[] = [
  {
    key: 'name',
    header: 'Team member',
    cell: (r) => (
      <div className="flex items-center gap-3 min-w-0">
        <span
          aria-hidden
          className="w-7 h-7 flex-none flex items-center justify-center text-[9px] font-sans font-semibold text-paper-raised"
          style={{ backgroundColor: r.color }}
        >
          {r.initials}
        </span>
        <div className="min-w-0">
          <span className="text-sm text-ink font-sans truncate block">{r.name}</span>
          <span className="text-[10px] font-sans text-ink-muted">{r.role}</span>
        </div>
      </div>
    ),
  },
  {
    key: 'totalAssigned',
    header: 'Assigned',
    width: '90px',
    align: 'right',
    cell: (r) => <span className="font-mono text-sm tabular-nums text-ink">{r.totalAssigned}</span>,
  },
  {
    key: 'completed',
    header: 'Completed',
    width: '100px',
    align: 'right',
    cell: (r) => <span className="font-mono text-sm tabular-nums text-filed">{r.completed}</span>,
  },
  {
    key: 'inProgress',
    header: 'In progress',
    width: '100px',
    align: 'right',
    cell: (r) => <span className="font-mono text-sm tabular-nums text-authority">{r.inProgress}</span>,
  },
  {
    key: 'overdue',
    header: 'Overdue',
    width: '80px',
    align: 'right',
    cell: (r) => (
      <span className={`font-mono text-sm tabular-nums ${r.overdue > 0 ? 'text-signal font-medium' : 'text-ink-muted'}`}>
        {r.overdue || '—'}
      </span>
    ),
  },
  {
    key: 'onTimeRate',
    header: 'On-time rate',
    width: '150px',
    cell: (r) => <HealthBar pct={r.onTimeRate} />,
  },
  {
    key: 'avgDays',
    header: 'Avg. days',
    width: '90px',
    align: 'right',
    cell: (r) => (
      <span className="font-mono text-sm tabular-nums text-ink-soft">{r.avgDaysToComplete.toFixed(1)}</span>
    ),
  },
];

// ─── Page ───────────────────────────────────────────────────────────

export function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>('compliance');
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<DateRangeValue>(DEFAULT_RANGE);

  // Compliance KPIs
  const totalFilings = COMPLIANCE_TREND.reduce((a, d) => a + d.onTime + d.late + d.overdue, 0);
  const totalOnTime = COMPLIANCE_TREND.reduce((a, d) => a + d.onTime, 0);
  const avgOnTimeRate = Math.round((totalOnTime / totalFilings) * 100);
  const totalOverdue = OVERDUE_ROWS.length;

  // Filter rows by search
  const filteredCompliance = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return COMPLIANCE_ROWS;
    return COMPLIANCE_ROWS.filter((r) => r.clientName.toLowerCase().includes(q));
  }, [search]);

  const filteredOverdue = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return OVERDUE_ROWS;
    return OVERDUE_ROWS.filter(
      (r) => `${r.filingName} ${r.clientName} ${r.handler} ${r.lawCode}`.toLowerCase().includes(q),
    );
  }, [search]);

  const filteredWorkload = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return WORKLOAD_ROWS;
    return WORKLOAD_ROWS.filter((r) => r.name.toLowerCase().includes(q));
  }, [search]);

  const reportTabs = [
    { value: 'compliance' as const, label: (<span className="inline-flex items-center gap-1.5"><TrendingUp className="w-3 h-3" strokeWidth={1.5} />Compliance Summary</span>) },
    { value: 'overdue' as const, label: (<span className="inline-flex items-center gap-1.5"><Clock className="w-3 h-3" strokeWidth={1.5} />Overdue Aging</span>) },
    { value: 'workload' as const, label: (<span className="inline-flex items-center gap-1.5"><Users className="w-3 h-3" strokeWidth={1.5} />Team Workload</span>) },
  ];

  return (
    <div className="min-h-screen bg-paper paper-grain">
      <ScreenPreviewTopBar active="reports" />

      <main className="max-w-[1480px] mx-auto px-10 py-8">
        {/* ─── Page header ──────────────────────────────────────── */}
        <header className="flex items-end justify-between mb-8">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted">
              <span>Analytics</span>
              <ChevronRight className="w-3 h-3" strokeWidth={1.5} />
              <span className="text-ink">Reports</span>
            </div>
            <h1 className="font-serif text-4xl text-ink leading-none mt-1">Reports</h1>
            <p className="mt-2 font-serif italic text-ink-soft max-w-2xl">
              {totalFilings} filings tracked — {avgOnTimeRate}% on-time rate, {totalOverdue} currently overdue.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <DateRangePopover value={dateRange} onChange={setDateRange} today={TODAY} />
            <Button variant="outline" size="sm">
              <Download className="w-3.5 h-3.5 mr-1.5" strokeWidth={2} />
              Export PDF
            </Button>
          </div>
        </header>

        {/* ─── KPI strip ────────────────────────────────────────── */}
        <section className="grid grid-cols-4 gap-px bg-rule border border-rule mb-8">
          <div className="bg-paper-raised px-5 py-4">
            <div className="text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted mb-1">
              Total filings
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-2xl tabular-nums text-ink">{totalFilings}</span>
              <span className="font-serif italic text-[11px] text-ink-muted">in period</span>
            </div>
          </div>
          <div className="bg-paper-raised px-5 py-4">
            <div className="text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted mb-1">
              On-time rate
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-2xl tabular-nums text-filed">{avgOnTimeRate}%</span>
              <span className="flex items-center gap-0.5 text-[11px] font-sans text-filed">
                <TrendingUp className="w-3 h-3" strokeWidth={1.5} />
                +2.1%
              </span>
            </div>
          </div>
          <div className="bg-paper-raised px-5 py-4">
            <div className="text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted mb-1">
              Currently overdue
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-2xl tabular-nums text-signal">{totalOverdue}</span>
              <span className="font-serif italic text-[11px] text-ink-muted">filings</span>
            </div>
          </div>
          <div className="bg-paper-raised px-5 py-4">
            <div className="text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted mb-1">
              Clients tracked
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-2xl tabular-nums text-ink">{COMPLIANCE_ROWS.length}</span>
              <span className="font-serif italic text-[11px] text-ink-muted">entities</span>
            </div>
          </div>
        </section>

        {/* ─── Report tabs ──────────────────────────────────────── */}
        <CoarseTabs
          tabs={reportTabs}
          value={activeTab}
          onChange={(v) => { setActiveTab(v); setSearch(''); }}
          animated
          className="mb-6"
        />

        {/* ─── Report content ───────────────────────────────────── */}
        {activeTab === 'compliance' && (
          <>
            {/* Chart section */}
            <section className="border border-rule bg-paper-raised p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <Eyebrow tone="muted">Filing trend</Eyebrow>
                  <p className="text-sm font-serif italic text-ink-soft mt-1">
                    Monthly filing breakdown by outcome
                  </p>
                </div>
                <div className="flex items-center gap-4 text-[10px] font-sans font-medium uppercase tracking-eyebrow">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-filed" aria-hidden /> On time
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-due-soon" aria-hidden /> Late
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-signal" aria-hidden /> Overdue
                  </span>
                </div>
              </div>
              <StackedBarChart data={COMPLIANCE_TREND} />
            </section>

            {/* Table */}
            <DataGridShell
              columns={COMPLIANCE_COLUMNS}
              rows={filteredCompliance}
              getRowKey={(r) => r.id}
              requiredColumns={['client']}
              totalRows={COMPLIANCE_ROWS.length}
              filters={
                <SearchInput
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search clients…"
                  wrapperClassName="min-w-[200px] max-w-xs flex-1"
                />
              }
            />
          </>
        )}

        {activeTab === 'overdue' && (
          <>
            {/* Chart + summary section */}
            <section className="grid grid-cols-2 gap-px bg-rule border border-rule mb-6">
              <div className="bg-paper-raised p-6">
                <Eyebrow tone="muted">Aging distribution</Eyebrow>
                <p className="text-sm font-serif italic text-ink-soft mt-1 mb-4">
                  Overdue filings by days past due
                </p>
                <AgingBarChart buckets={AGING_BUCKETS} />
              </div>
              <div className="bg-paper-raised p-6">
                <Eyebrow tone="muted">Severity breakdown</Eyebrow>
                <p className="text-sm font-serif italic text-ink-soft mt-1 mb-4">
                  Impact assessment of overdue items
                </p>
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-signal" strokeWidth={1.5} />
                      <span className="text-sm font-sans text-ink">Critical</span>
                    </div>
                    <span className="font-mono text-lg tabular-nums text-signal font-medium">
                      {OVERDUE_ROWS.filter((r) => r.priority === 'critical').length}
                    </span>
                  </div>
                  <div className="border-t border-rule" />
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-due-soon" strokeWidth={1.5} />
                      <span className="text-sm font-sans text-ink">High</span>
                    </div>
                    <span className="font-mono text-lg tabular-nums text-due-soon font-medium">
                      {OVERDUE_ROWS.filter((r) => r.priority === 'high').length}
                    </span>
                  </div>
                  <div className="border-t border-rule" />
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-ink-muted" strokeWidth={1.5} />
                      <span className="text-sm font-sans text-ink">Medium</span>
                    </div>
                    <span className="font-mono text-lg tabular-nums text-ink-soft font-medium">
                      {OVERDUE_ROWS.filter((r) => r.priority === 'medium').length}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* Table */}
            <DataGridShell
              columns={OVERDUE_COLUMNS}
              rows={filteredOverdue}
              getRowKey={(r) => r.id}
              requiredColumns={['filing']}
              totalRows={OVERDUE_ROWS.length}
              filters={
                <SearchInput
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search filings, clients, handlers…"
                  wrapperClassName="min-w-[200px] max-w-xs flex-1"
                />
              }
            />
          </>
        )}

        {activeTab === 'workload' && (
          <>
            {/* Chart section */}
            <section className="border border-rule bg-paper-raised p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <Eyebrow tone="muted">Filing distribution</Eyebrow>
                  <p className="text-sm font-serif italic text-ink-soft mt-1">
                    Filings per team member by status
                  </p>
                </div>
                <div className="flex items-center gap-4 text-[10px] font-sans font-medium uppercase tracking-eyebrow">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-filed" aria-hidden /> Completed
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-authority" aria-hidden /> In progress
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-signal" aria-hidden /> Overdue
                  </span>
                </div>
              </div>
              <WorkloadBarChart rows={WORKLOAD_ROWS} />
            </section>

            {/* Table */}
            <DataGridShell
              columns={WORKLOAD_COLUMNS}
              rows={filteredWorkload}
              getRowKey={(r) => r.id}
              requiredColumns={['name']}
              totalRows={WORKLOAD_ROWS.length}
              filters={
                <SearchInput
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search team members…"
                  wrapperClassName="min-w-[200px] max-w-xs flex-1"
                />
              }
            />
          </>
        )}
      </main>
    </div>
  );
}
