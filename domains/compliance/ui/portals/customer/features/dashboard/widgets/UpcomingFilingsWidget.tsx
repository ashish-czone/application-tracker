import { useMemo } from 'react';
import { Link } from 'react-router';
import { CalendarCheck } from 'lucide-react';
import { Skeleton } from '@packages/ui';
import { JurisdictionTag, type Jurisdiction } from '../../../../../components';
import { useUpcomingFilings, type FilingListRow } from '../../../../../hooks/useFilingsByDueWindow';

const WIDGET_LIMIT = 8;
const WINDOW_DAYS = 7;

type DueBucket = 'Due today' | 'This week';

function bucketFor(dueDate: string | null, todayMs: number): DueBucket | null {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - todayMs) / 86_400_000);
  if (days === 0) return 'Due today';
  if (days > 0 && days <= WINDOW_DAYS) return 'This week';
  return null;
}

function formatDueDay(dueDate: string | null): string {
  if (!dueDate) return '';
  const due = new Date(dueDate);
  return due.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function jurisdictionFor(row: FilingListRow): Jurisdiction {
  const j = row.lawJurisdiction;
  if (j === 'central' || j === 'state' || j === 'municipal' || j === 'international') return j;
  return 'central';
}

export function UpcomingFilingsWidget() {
  const { rows, loading, error } = useUpcomingFilings({
    limit: WIDGET_LIMIT,
    withinDays: WINDOW_DAYS,
  });

  const grouped = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();

    const buckets = new Map<DueBucket, FilingListRow[]>();
    for (const filing of rows) {
      const bucket = bucketFor(filing.dueDate, todayMs);
      if (!bucket) continue;
      const list = buckets.get(bucket);
      if (list) list.push(filing);
      else buckets.set(bucket, [filing]);
    }
    return Array.from(buckets.entries());
  }, [rows]);

  const totalCount = grouped.reduce((sum, [, items]) => sum + items.length, 0);

  if (loading) {
    return (
      <ul className="divide-y divide-rule">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i} className="flex items-center gap-3 px-5 py-3">
            <Skeleton className="h-10 w-16 rounded-sm" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-2 w-1/3" />
            </div>
          </li>
        ))}
      </ul>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center px-5 py-10 text-center">
        <p className="text-sm text-ink-soft">Could not load upcoming filings.</p>
      </div>
    );
  }

  if (totalCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-5 py-10 text-center">
        <CalendarCheck className="w-6 h-6 text-ink-muted mb-2" strokeWidth={1.5} />
        <p className="font-serif italic text-ink-soft">Nothing due this week.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {grouped.map(([bucket, items]) => (
        <section key={bucket}>
          <header className="px-5 py-1.5 bg-paper-subtle border-b border-rule">
            <p className="text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted">
              {bucket}
            </p>
          </header>
          <ul className="divide-y divide-rule">
            {items.map((filing) => (
              <li key={filing.id} className="flex items-center gap-4 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-ink truncate">{filing.clientName ?? '—'}</p>
                  <p className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-muted">
                    <span className="font-mono uppercase tracking-tabular">
                      {filing.lawCode ?? ''}
                    </span>
                    <JurisdictionTag jurisdiction={jurisdictionFor(filing)} />
                  </p>
                </div>
                <p className="text-[11px] text-ink-soft font-sans tabular-nums shrink-0">
                  {formatDueDay(filing.dueDate)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <Link
        to="/filings"
        className="border-t border-rule px-5 py-2 text-[11px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted hover:text-ink"
      >
        Full calendar →
      </Link>
    </div>
  );
}
