import { Plus } from 'lucide-react';
import { Button } from '@packages/ui';
import { DashboardShell } from '@packages/dashboard-ui';
import { ScreenPreviewTopBar } from '../screens/shared/ScreenPreviewTopBar';

// Widget order tuned for the 12-col grid at xl:
//   overdue (lg, 8 cols) + notifications (sm, 3 cols) → row 1
//   upcoming (md, 6 cols) + my-tasks (md, 6 cols)     → row 2
const DASHBOARD_WIDGETS = [
  'compliance.overdue-filings',
  'notifications.recent',
  'compliance.upcoming-filings',
  'tasks.my-tasks',
] as const;

export function DashboardPage() {
  const formattedToday = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-paper paper-grain">
      <ScreenPreviewTopBar active="dashboard" />

      <main className="max-w-[1480px] mx-auto px-10 py-8">
        <DashboardShell
          widgetIds={DASHBOARD_WIDGETS}
          header={
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
          }
        />
      </main>
    </div>
  );
}
