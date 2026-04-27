import { useMemo } from 'react';
import { Link } from 'react-router';
import { CalendarCheck } from 'lucide-react';
import { Skeleton } from '@packages/ui';
import { JurisdictionTag } from '../../../../../components';
import type { Filing } from '../../../../../shared';
import { useComplianceFilingRows } from '../../../../../hooks/useComplianceFilings';

type DueBucket = 'Due today' | 'This week';

function bucketFor(filing: Filing): DueBucket | null {
  if (filing.status === 'due-today') return 'Due today';
  if (filing.status === 'due-this-week') return 'This week';
  return null;
}

function formatDueDay(dueDate: string): string {
  if (!dueDate) return '';
  const due = new Date(dueDate);
  return due.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function UpcomingFilingsWidget() {
  const { rows, loading, error } = useComplianceFilingRows();

  const grouped = useMemo(() => {
    const upcoming = rows
      .filter((r) => bucketFor(r) !== null)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 8);

    const buckets = new Map<DueBucket, Filing[]>();
    for (const filing of upcoming) {
      const bucket = bucketFor(filing)!;
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
                  <p className="text-sm text-ink truncate">{filing.clientName}</p>
                  <p className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-muted">
                    <span className="font-mono uppercase tracking-tabular">
                      {filing.lawCode}
                    </span>
                    <JurisdictionTag jurisdiction={filing.jurisdiction} />
                    {filing.periodLabel ? (
                      <span className="font-serif italic text-ink-soft">
                        {filing.periodLabel}
                      </span>
                    ) : null}
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
