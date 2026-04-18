import { useMemo } from 'react';
import { Plus, AlertTriangle } from 'lucide-react';
import { MetricKPI, DataTable, Button, ActivityTimeline } from '@packages/ui';
import { Can } from '@packages/auth-ui';
import { ComplianceCalendar, HandlerWorkloadList } from '../../../../../shared';
import { PREVIEW_TODAY, MOCK_FILINGS, MOCK_WORKLOADS } from '../../console-preview/mockData';
import { DASHBOARD_ACTIVITY } from './data/dashboardMock';
import { DASHBOARD_COLUMNS } from './components/dashboardColumns';
import { DASHBOARD_ACTIVITY_ICONS } from './components/dashboardActivityIcons';
import { ScreenPreviewTopBar } from '../shared/ScreenPreviewTopBar';

const MY_HANDLER_ID = 'h4';

export function DashboardScreenPage() {
  const myFilings = useMemo(() => {
    return MOCK_FILINGS.filter((f) => f.handler?.id === MY_HANDLER_ID && f.status !== 'filed')
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 8);
  }, []);

  const workQueue =
    myFilings.length > 0
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
      <ScreenPreviewTopBar active="dashboard" />

      <main className="max-w-[1480px] mx-auto px-10 py-8">
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

        <Can permission="filings.read">
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
        </Can>

        <Can permission="filings.read">
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
        </Can>

        <section className="mt-8 grid grid-cols-12 gap-6">
          <Can permission="filings.read">
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
          </Can>
        </section>

        <section className="mt-10 grid grid-cols-12 gap-6">
          <Can permission="audit.read">
            <div className="col-span-12 lg:col-span-5">
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="font-serif text-xl text-ink leading-none">Recent activity</h2>
                <a className="text-[11px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted hover:text-ink">
                  Audit trail →
                </a>
              </div>
              <div className="bg-paper-raised border border-rule px-5 py-4">
                <ActivityTimeline
                  events={DASHBOARD_ACTIVITY}
                  iconConfig={DASHBOARD_ACTIVITY_ICONS}
                  variant="feed"
                />
              </div>
            </div>
          </Can>
          <Can permission="users.read">
            <div className="col-span-12 lg:col-span-7">
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="font-serif text-xl text-ink leading-none">Team workload</h2>
                <a className="text-[11px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted hover:text-ink">
                  Rebalance →
                </a>
              </div>
              <HandlerWorkloadList workloads={MOCK_WORKLOADS} />
            </div>
          </Can>
        </section>
      </main>
    </div>
  );
}
