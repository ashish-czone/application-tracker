import { useMemo, type HTMLAttributes } from 'react';
import { Eyebrow } from '@packages/ui';
import type { Filing } from '../../types';

export interface FilingTimelineProps extends HTMLAttributes<HTMLDivElement> {
  filings: Filing[];
  /** Start of the window. Defaults to today. */
  start?: Date;
  /** Number of days in the window. Defaults to 14. */
  days?: number;
  onFilingClick?: (filing: Filing) => void;
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Horizontal timeline showing filings laid out against a ruled baseline.
 * Each filing is an ink mark positioned on its due date; hovering reveals
 * the client/law. Think: a conductor's score, not a Gantt chart.
 */
export function FilingTimeline({
  filings,
  start,
  days = 14,
  onFilingClick,
  className = '',
  ...rest
}: FilingTimelineProps) {
  const anchor = useMemo(() => {
    const d = start ? new Date(start) : new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, [start]);

  const range = useMemo(() => {
    const arr: Date[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(anchor);
      d.setDate(anchor.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, [anchor, days]);

  const placed = useMemo(() => {
    return filings
      .map((f) => {
        const due = new Date(f.dueDate);
        due.setHours(0, 0, 0, 0);
        const delta = Math.round((due.getTime() - anchor.getTime()) / 86_400_000);
        if (delta < 0 || delta >= days) return null;
        return { filing: f, dayIndex: delta };
      })
      .filter((x): x is { filing: Filing; dayIndex: number } => x !== null);
  }, [filings, anchor, days]);

  // Group by day index for stacking
  const byDay = useMemo(() => {
    const map = new Map<number, Filing[]>();
    placed.forEach(({ filing, dayIndex }) => {
      const arr = map.get(dayIndex) ?? [];
      arr.push(filing);
      map.set(dayIndex, arr);
    });
    return map;
  }, [placed]);

  const maxStack = Math.max(1, ...Array.from(byDay.values()).map((arr) => arr.length));
  const rowHeight = 22;
  const padding = 16;
  const innerHeight = maxStack * rowHeight + padding * 2;

  return (
    <div className={`bg-paper-raised border border-rule ${className}`} {...rest}>
      <div className="flex items-center justify-between px-5 py-3 border-b border-rule">
        <div>
          <Eyebrow tone="muted">Upcoming Filings</Eyebrow>
          <h3 className="font-serif text-xl text-ink leading-none mt-1">
            Next <span className="font-mono tabular-nums">{days}</span> days
          </h3>
        </div>
        <span className="text-[11px] font-mono tabular-nums text-ink-muted">
          {placed.length} filings
        </span>
      </div>

      <div className="relative px-5 pt-4 pb-6" style={{ minHeight: innerHeight }}>
        {/* Day baseline */}
        <div className="absolute left-5 right-5 bottom-6 border-t border-rule" />

        {/* Day ticks */}
        <div className="absolute left-5 right-5 bottom-0 grid" style={{ gridTemplateColumns: `repeat(${days}, 1fr)` }}>
          {range.map((d, i) => {
            const isMonthStart = d.getDate() === 1 || i === 0;
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            return (
              <div
                key={i}
                className={`relative h-6 border-r border-rule/60 last:border-r-0 ${
                  isWeekend ? 'bg-paper-sunken/30' : ''
                }`}
              >
                <div className="absolute inset-x-0 top-0 flex flex-col items-center pt-1">
                  <span
                    className={`font-mono tabular-nums text-[10px] leading-none ${
                      i === 0 ? 'text-signal font-bold' : 'text-ink-muted'
                    }`}
                  >
                    {d.getDate()}
                  </span>
                  {isMonthStart && (
                    <span className="text-[9px] uppercase tracking-eyebrow text-ink-soft mt-0.5">
                      {MONTHS_SHORT[d.getMonth()]}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Filings as stacked marks */}
        <div
          className="absolute left-5 right-5 top-4 grid"
          style={{ gridTemplateColumns: `repeat(${days}, 1fr)`, height: innerHeight - 48 }}
        >
          {Array.from({ length: days }).map((_, dayIdx) => {
            const dayFilings = byDay.get(dayIdx) ?? [];
            return (
              <div key={dayIdx} className="relative">
                {dayFilings.map((f, stackIdx) => {
                  const tone =
                    f.status === 'overdue' || f.status === 'due-today'
                      ? 'bg-signal text-paper-raised border-signal'
                      : f.status === 'due-this-week'
                        ? 'bg-due-soon text-ink border-due-soon'
                        : f.status === 'filed'
                          ? 'bg-filed-soft text-filed border-filed line-through'
                          : 'bg-paper-raised text-ink border-ink-soft';
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => onFilingClick?.(f)}
                      className={`absolute left-0.5 right-0.5 border px-1.5 py-0.5 text-[9px] font-mono tabular-nums uppercase tracking-tabular truncate text-left hover:z-10 hover:scale-105 hover:-translate-y-[1px] transition-transform ${tone}`}
                      style={{ top: stackIdx * rowHeight }}
                      title={`${f.clientName} · ${f.ruleName}`}
                    >
                      {f.lawCode}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
