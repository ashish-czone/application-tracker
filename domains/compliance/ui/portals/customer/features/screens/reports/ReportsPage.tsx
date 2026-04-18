import { useState, useMemo } from 'react';
import { startOfMonth, subMonths } from 'date-fns';
import { Download, TrendingUp, Clock, Users } from 'lucide-react';
import {
  DataGridShell,
  Button,
  CoarseTabs,
  Eyebrow,
  SearchInput,
  ScreenLayout,
} from '@packages/ui';
import { DateRangePopover, type DateRangeValue } from '../../../../../shared';
import { ScreenPreviewTopBar } from '../shared/ScreenPreviewTopBar';
import {
  COMPLIANCE_TREND,
  COMPLIANCE_ROWS,
  AGING_BUCKETS,
  OVERDUE_ROWS,
  WORKLOAD_ROWS,
  type ReportTab,
} from './data/reportsMock';
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

const TODAY = new Date('2026-04-17');
const DEFAULT_RANGE: DateRangeValue = {
  from: startOfMonth(subMonths(TODAY, 5)),
  to: TODAY,
};

export function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>('compliance');
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<DateRangeValue>(DEFAULT_RANGE);

  const totalFilings = COMPLIANCE_TREND.reduce((a, d) => a + d.onTime + d.late + d.overdue, 0);
  const totalOnTime = COMPLIANCE_TREND.reduce((a, d) => a + d.onTime, 0);
  const avgOnTimeRate = Math.round((totalOnTime / totalFilings) * 100);
  const totalOverdue = OVERDUE_ROWS.length;

  const filteredCompliance = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return COMPLIANCE_ROWS;
    return COMPLIANCE_ROWS.filter((r) => r.clientName.toLowerCase().includes(q));
  }, [search]);

  const filteredOverdue = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return OVERDUE_ROWS;
    return OVERDUE_ROWS.filter((r) =>
      `${r.filingName} ${r.clientName} ${r.handler} ${r.lawCode}`.toLowerCase().includes(q),
    );
  }, [search]);

  const filteredWorkload = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return WORKLOAD_ROWS;
    return WORKLOAD_ROWS.filter((r) => r.name.toLowerCase().includes(q));
  }, [search]);

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
          <DateRangePopover value={dateRange} onChange={setDateRange} today={TODAY} />
          <Button variant="outline" size="sm">
            <Download className="w-3.5 h-3.5 mr-1.5" strokeWidth={2} />
            Export PDF
          </Button>
        </>
      }
    >
      <ReportsKpiStrip
        totalFilings={totalFilings}
        avgOnTimeRate={avgOnTimeRate}
        totalOverdue={totalOverdue}
        clientsTracked={COMPLIANCE_ROWS.length}
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
            <ComplianceTrendChart data={COMPLIANCE_TREND} />
          </section>

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
              <SeverityBreakdown rows={OVERDUE_ROWS} />
            </div>
          </section>

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
    </ScreenLayout>
  );
}
