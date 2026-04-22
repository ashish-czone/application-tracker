import { useMemo } from 'react';
import { Link } from 'react-router';
import { AlertTriangle } from 'lucide-react';
import { Skeleton } from '@packages/ui';
import { JurisdictionTag } from '../../../../../components';
import { useComplianceTaskRows } from '../../screens/tasks/api/useComplianceTasks';

function daysOverdue(dueDate: string): number {
  if (!dueDate) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((today.getTime() - due.getTime()) / 86_400_000));
}

export function OverdueFilingsWidget() {
  const { rows, loading, error } = useComplianceTaskRows();

  const overdue = useMemo(
    () =>
      rows
        .filter((r) => r.status === 'overdue')
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()),
    [rows],
  );
  const top = overdue.slice(0, 5);
  const totalCount = overdue.length;

  if (loading) {
    return (
      <ul className="divide-y divide-rule">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i} className="flex items-center gap-4 px-5 py-3">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-2 w-1/3" />
            </div>
            <Skeleton className="h-4 w-16" />
          </li>
        ))}
      </ul>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center px-5 py-10 text-center">
        <p className="text-sm text-ink-soft">Could not load filings.</p>
      </div>
    );
  }

  if (totalCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-5 py-10 text-center">
        <AlertTriangle className="w-6 h-6 text-filed mb-2" strokeWidth={1.5} />
        <p className="font-serif italic text-ink-soft">Nothing overdue. Clean desk.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <ul className="divide-y divide-rule">
        {top.map((filing) => {
          const days = daysOverdue(filing.dueDate);
          return (
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
              <div className="text-right shrink-0">
                <p className="font-sans font-medium text-signal text-sm tabular-nums">
                  {days}d
                </p>
                <p className="text-[10px] uppercase tracking-eyebrow text-signal/80">
                  overdue
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      {totalCount > top.length ? (
        <Link
          to="/filings"
          className="border-t border-rule px-5 py-2 text-[11px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted hover:text-ink"
        >
          View all {totalCount} overdue →
        </Link>
      ) : null}
    </div>
  );
}
