import { useState, useMemo } from 'react';
import { Link } from 'react-router';
import { format, startOfMonth, subMonths } from 'date-fns';
import { ChevronDown, Download, TrendingUp, Clock, Users } from 'lucide-react';
import {
  DataGridShell,
  Button,
  CoarseTabs,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  Eyebrow,
  SearchInput,
  ScreenLayout,
} from '@packages/ui';
import { DateRangePopover, type DateRangeValue } from '../../../../components/composites';
import { ScreenPreviewTopBar } from '../shared/ScreenPreviewTopBar';
import type { ReportTab, ComplianceRow, OverdueRow, WorkloadRow, AgingBucket as AgingBucketDisplay } from './types';
import { ReportsKpiStrip } from './components/ReportsKpiStrip';
import { ComplianceTrendChart } from './components/ComplianceTrendChart';
import { AgingBarChart } from './components/AgingBarChart';
import { WorkloadBarChart } from './components/WorkloadBarChart';
import { SeverityBreakdown } from './components/SeverityBreakdown';
import {
  COMPLIANCE_COLUMNS,
  OVERDUE_COLUMNS,
  WORKLOAD_COLUMNS,
} from './components/reportsColumns';
import {
  useComplianceTrend,
  useComplianceByClient,
  useOverdueAging,
  useTeamWorkload,
  type AgingBucket as ApiAgingBucket,
  type ClientBreakdownRow,
  type TeamWorkloadRow,
} from '../../../../hooks/useComplianceReports';
import { useDebouncedValue } from '../../../../hooks/useDebouncedValue';
import { useFilingsList } from '../../../../hooks/useFilingsList';
import { useFilingsSummary } from '../../../../hooks/useFilingsSummary';
import { initialsFromName, colorForClient } from '../clients/api/mapClientRecord';
import { downloadReport, type ReportDownloadFormat } from './downloadReport';

/**
 * Translates the active report tab + format into a server export path.
 * The path carries the same date-range filter the user has applied on
 * screen so the export matches what they're looking at; `q` stays out
 * of the URL because the export is the operator-friendly artefact ("the
 * full picture for this period") and search-narrowing belongs to the
 * on-screen view.
 */
function buildExportPath(
  tab: ReportTab,
  format: ReportDownloadFormat,
  range: { from: string; to: string },
): string {
  const params = new URLSearchParams({ from: range.from, to: range.to });
  switch (tab) {
    case 'compliance':
      return `/compliance-filings/reports/compliance.${format}?${params.toString()}`;
    case 'overdue':
      // Overdue is always "as of today" — date range doesn't apply.
      return `/compliance-filings/reports/overdue.${format}`;
    case 'workload':
      return `/org-units/reports/team-workload.${format}?${params.toString()}`;
    default:
      return `/compliance-filings/reports/compliance.${format}?${params.toString()}`;
  }
}

function toCalendarDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function defaultRange(): DateRangeValue {
  const today = new Date();
  return {
    from: startOfMonth(subMonths(today, 5)),
    to: today,
  };
}

const AGING_BUCKET_LABELS: Record<ApiAgingBucket['range'], string> = {
  '1-7': '1–7 days',
  '8-15': '8–15 days',
  '16-30': '16–30 days',
  '30+': '30+ days',
};
const AGING_BUCKET_TONES: Record<ApiAgingBucket['range'], 'due-soon' | 'signal'> = {
  '1-7': 'due-soon',
  '8-15': 'signal',
  '16-30': 'signal',
  '30+': 'signal',
};

function mapClientBreakdown(rows: ClientBreakdownRow[]): ComplianceRow[] {
  return rows.map((r) => ({
    id: r.clientId,
    clientName: r.clientName || '—',
    initials: initialsFromName(r.clientName || '—'),
    color: colorForClient(r.clientId, r.clientName || ''),
    totalFilings: r.totalFilings,
    onTime: r.onTime,
    late: r.late,
    overdue: r.overdue,
    onTimeRate: r.onTimeRate,
  }));
}

function mapTeamWorkload(rows: TeamWorkloadRow[]): WorkloadRow[] {
  return rows.map((r) => ({
    id: r.assigneeTeamId,
    name: r.assigneeTeamName || '—',
    initials: initialsFromName(r.assigneeTeamName || '—'),
    color: colorForClient(r.assigneeTeamId, r.assigneeTeamName || ''),
    role: '—',
    totalAssigned: r.totalAssigned,
    completed: r.completed,
    inProgress: r.inProgress,
    overdue: r.overdue,
    onTimeRate: r.onTimeRate,
    avgDaysToComplete: 0,
  }));
}

const PRIORITY_MAP: Record<string, OverdueRow['priority']> = {
  urgent: 'critical',
  high: 'high',
  medium: 'medium',
  low: 'medium',
};

function mapOverdueFilings(rows: ReturnType<typeof useFilingsList>['rows']): OverdueRow[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return rows.map((r) => {
    const dueDate = r.dueDate ?? '';
    const daysOverdue = dueDate
      ? Math.max(0, Math.round((today.getTime() - new Date(dueDate).getTime()) / 86_400_000))
      : 0;
    const clientName = r.clientName ?? '';
    const handlerName = r.assigneeTeamName ?? '';
    return {
      id: r.id,
      filingName: r.title,
      lawCode: r.lawCode ?? '',
      clientName,
      clientInitials: initialsFromName(clientName || '—'),
      clientColor: colorForClient(r.clientId, clientName),
      dueDate,
      daysOverdue,
      handler: handlerName || '—',
      handlerInitials: initialsFromName(handlerName || '—'),
      priority: PRIORITY_MAP[r.priority] ?? 'medium',
    };
  });
}

function mapAgingBuckets(rows: ApiAgingBucket[]): AgingBucketDisplay[] {
  return rows.map((r) => ({
    range: r.range,
    label: AGING_BUCKET_LABELS[r.range],
    count: r.count,
    tone: AGING_BUCKET_TONES[r.range],
  }));
}

export function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>('compliance');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [dateRange, setDateRange] = useState<DateRangeValue>(defaultRange());

  const range = useMemo(
    () => ({
      from: toCalendarDate(dateRange.from),
      to: toCalendarDate(dateRange.to),
    }),
    [dateRange],
  );

  // Trend doesn't take `q` (it aggregates by month, not by client name).
  const trend = useComplianceTrend(range);
  const byClient = useComplianceByClient({
    ...range,
    q: debouncedSearch || undefined,
  });
  const aging = useOverdueAging();
  const workload = useTeamWorkload({
    ...range,
    q: debouncedSearch || undefined,
  });
  // Show the 20 most-overdue filings on screen — past 20 the user follows the
  // "View all N" link to the full /filings page (which paginates server-side).
  // Per .claude/rules/data-fetching.md, a paginated list MUST surface
  // truncation; we render `meta.total` next to the table so the user knows
  // how many more rows the export covers.
  const OVERDUE_TOP_N = 20;
  const overdueFilings = useFilingsList({
    page: 1,
    limit: OVERDUE_TOP_N,
    sort: 'dueDate:asc',
    bucket: 'overdue',
    search: debouncedSearch || undefined,
  });
  const overdueTotal = overdueFilings.meta?.total ?? overdueFilings.rows.length;
  const overdueHasMore = overdueTotal > overdueFilings.rows.length;
  const summary = useFilingsSummary();

  const trendForChart = useMemo(
    () =>
      trend.rows.map((r) => ({
        month: format(new Date(`${r.month}-01T00:00:00Z`), 'MMM'),
        onTime: r.onTime,
        late: r.late,
        overdue: r.overdue,
      })),
    [trend.rows],
  );

  const totalFilings = trend.rows.reduce((a, d) => a + d.onTime + d.late + d.overdue, 0);
  const totalOnTime = trend.rows.reduce((a, d) => a + d.onTime, 0);
  const avgOnTimeRate = totalFilings > 0 ? Math.round((totalOnTime / totalFilings) * 100) : 0;
  const totalOverdue = summary.summary.overdue;

  // Server applies the `q` filter via the underlying queries, so the rows
  // returned here are already narrowed. No client-side .filter() — past the
  // page's first 50 rows the JS filter would silently lose matches.
  const filteredCompliance = useMemo(
    () => mapClientBreakdown(byClient.rows),
    [byClient.rows],
  );
  const filteredOverdue = useMemo(
    () => mapOverdueFilings(overdueFilings.rows),
    [overdueFilings.rows],
  );
  const filteredWorkload = useMemo(
    () => mapTeamWorkload(workload.rows),
    [workload.rows],
  );

  const agingDisplay = useMemo(() => mapAgingBuckets(aging.rows), [aging.rows]);

  const reportTabs = [
    {
      value: 'compliance' as const,
      label: (
        <span className="inline-flex items-center gap-1.5">
          <TrendingUp className="w-3 h-3" strokeWidth={1.5} />
          Compliance Summary
        </span>
      ),
    },
    {
      value: 'overdue' as const,
      label: (
        <span className="inline-flex items-center gap-1.5">
          <Clock className="w-3 h-3" strokeWidth={1.5} />
          Overdue Aging
        </span>
      ),
    },
    {
      value: 'workload' as const,
      label: (
        <span className="inline-flex items-center gap-1.5">
          <Users className="w-3 h-3" strokeWidth={1.5} />
          Team Workload
        </span>
      ),
    },
  ];

  return (
    <ScreenLayout
      topBar={<ScreenPreviewTopBar active="reports" />}
      breadcrumb={['Analytics', 'Reports']}
      title="Reports"
      subtitle={
        <>
          {totalFilings} filings tracked — {avgOnTimeRate}% on-time rate, {totalOverdue} currently
          overdue.
        </>
      }
      actions={
        <>
          <DateRangePopover value={dateRange} onChange={setDateRange} today={new Date()} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="w-3.5 h-3.5 mr-1.5" strokeWidth={2} />
                Download
                <ChevronDown className="w-3.5 h-3.5 ml-1.5" strokeWidth={2} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={4} className="min-w-[140px]">
              {(['csv', 'pdf'] as const).map((fmt) => (
                <DropdownMenuItem
                  key={fmt}
                  onSelect={() => {
                    // Fire-and-forget: surface failures via a thrown error
                    // in the helper (caught by the global error boundary).
                    // No spinner — the download fires immediately on success.
                    void downloadReport(
                      buildExportPath(activeTab, fmt, range),
                      `${activeTab}-report.${fmt}`,
                    );
                  }}
                >
                  {fmt.toUpperCase()}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      }
    >
      <ReportsKpiStrip
        totalFilings={totalFilings}
        avgOnTimeRate={avgOnTimeRate}
        totalOverdue={totalOverdue}
        clientsTracked={byClient.rows.length}
      />

      <CoarseTabs
        tabs={reportTabs}
        value={activeTab}
        onChange={(v) => {
          setActiveTab(v);
          setSearch('');
        }}
        animated
        className="mb-6"
      />

      {activeTab === 'compliance' && (
        <>
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
            <ComplianceTrendChart data={trendForChart} />
          </section>

          <DataGridShell
            columns={COMPLIANCE_COLUMNS}
            rows={filteredCompliance}
            getRowKey={(r) => r.id}
            requiredColumns={['client']}
            totalRows={filteredCompliance.length}
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
          <section className="grid grid-cols-2 gap-px bg-rule border border-rule mb-6">
            <div className="bg-paper-raised p-6">
              <Eyebrow tone="muted">Aging distribution</Eyebrow>
              <p className="text-sm font-serif italic text-ink-soft mt-1 mb-4">
                Overdue filings by days past due
              </p>
              <AgingBarChart buckets={agingDisplay} />
            </div>
            <div className="bg-paper-raised p-6">
              <Eyebrow tone="muted">Severity breakdown</Eyebrow>
              <p className="text-sm font-serif italic text-ink-soft mt-1 mb-4">
                Impact assessment of overdue items
              </p>
              <SeverityBreakdown rows={filteredOverdue} />
            </div>
          </section>

          {overdueHasMore ? (
            <p className="mb-3 text-[11px] uppercase tracking-eyebrow font-sans text-ink-muted">
              Showing top {filteredOverdue.length} of {overdueTotal} overdue ·{' '}
              <Link
                to="/filings?status=overdue"
                className="text-ink hover:text-signal underline underline-offset-2"
              >
                view all in filings →
              </Link>
            </p>
          ) : null}

          <DataGridShell
            columns={OVERDUE_COLUMNS}
            rows={filteredOverdue}
            getRowKey={(r) => r.id}
            requiredColumns={['filing']}
            totalRows={overdueTotal}
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
            <WorkloadBarChart rows={filteredWorkload} />
          </section>

          <DataGridShell
            columns={WORKLOAD_COLUMNS}
            rows={filteredWorkload}
            getRowKey={(r) => r.id}
            requiredColumns={['name']}
            totalRows={filteredWorkload.length}
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
    </ScreenLayout>
  );
}
