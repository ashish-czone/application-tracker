import { useMemo, type HTMLAttributes } from 'react';
import { Eyebrow } from '@packages/ui';
import type { Filing } from './types';

export interface ComplianceCalendarProps extends HTMLAttributes<HTMLDivElement> {
  filings: Filing[];
  /** Anchor month — defaults to current. */
  month?: Date;
  /** Handler invoked on day click. */
  onDayClick?: (date: Date, filingsForDay: Filing[]) => void;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface Cell {
  date: Date;
  inMonth: boolean;
  filings: Filing[];
  isToday: boolean;
}

function buildCells(anchor: Date, filings: Filing[]): Cell[] {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const first = new Date(year, month, 1);
  // ISO week: Monday = 0
  const leading = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - leading);
  const cells: Cell[] = [];
  const today = new Date();
  for (let i = 0; i < 42; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const dayFilings = filings.filter((f) => {
      const d = new Date(f.dueDate);
      return (
        d.getFullYear() === date.getFullYear() &&
        d.getMonth() === date.getMonth() &&
        d.getDate() === date.getDate()
      );
    });
    cells.push({
      date,
      inMonth: date.getMonth() === month,
      filings: dayFilings,
      isToday:
        today.getFullYear() === date.getFullYear() &&
        today.getMonth() === date.getMonth() &&
        today.getDate() === date.getDate(),
    });
  }
  return cells;
}

/**
 * Month-grid calendar rendered like a newspaper TV listing. Days are tall
 * cells with hairline borders. Filings inside a day are rendered as small
 * typeset rows (code · count) — not dots or circles. The top row shows
 * weekday eyebrows. Overdue/due-today days get a signal tint.
 */
export function ComplianceCalendar({
  filings,
  month,
  onDayClick,
  className = '',
  ...rest
}: ComplianceCalendarProps) {
  const anchor = month ?? new Date();
  const cells = useMemo(() => buildCells(anchor, filings), [anchor, filings]);
  const monthLabel = anchor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className={`bg-paper-raised border border-rule ${className}`} {...rest}>
      <div className="flex items-center justify-between px-5 py-3 border-b border-rule">
        <div>
          <Eyebrow tone="muted">Filing Calendar</Eyebrow>
          <h3 className="font-serif text-2xl text-ink leading-none mt-1">{monthLabel}</h3>
        </div>
        <div className="flex items-center gap-4 text-[10px] uppercase tracking-eyebrow text-ink-muted font-sans">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-signal" /> Overdue
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-due-soon" /> Due
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-filed" /> Filed
          </span>
        </div>
      </div>
      <div className="grid grid-cols-7 border-b border-rule/60">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="py-2 text-center border-r border-rule/60 last:border-r-0 text-[10px] uppercase tracking-eyebrow text-ink-muted font-sans"
          >
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 grid-rows-6">
        {cells.map((cell, i) => {
          const hasOverdue = cell.filings.some((f) => f.status === 'overdue');
          const hasDue = cell.filings.some((f) => f.status === 'due-today' || f.status === 'due-this-week');
          return (
            <button
              key={i}
              type="button"
              onClick={() => onDayClick?.(cell.date, cell.filings)}
              className={`group relative text-left px-2 pt-2 pb-2 min-h-[84px] border-r border-b border-rule/40 last-in-row:border-r-0 transition-colors hover:bg-paper-sunken/40 ${
                !cell.inMonth ? 'bg-paper-sunken/30' : ''
              } ${cell.isToday ? 'bg-due-soon-soft/40' : ''}`}
              style={{
                borderRightWidth: (i + 1) % 7 === 0 ? 0 : 1,
                borderBottomWidth: i >= 35 ? 0 : 1,
              }}
            >
              <div className="flex items-start justify-between mb-1">
                <span
                  className={`font-mono tabular-nums text-[13px] leading-none ${
                    cell.inMonth ? 'text-ink' : 'text-ink-muted/60'
                  } ${cell.isToday ? 'font-bold text-signal' : ''}`}
                >
                  {cell.date.getDate()}
                </span>
                {cell.filings.length > 0 && (
                  <span className="flex items-center gap-0.5">
                    {hasOverdue && <span className="w-1 h-1 bg-signal rounded-full" />}
                    {hasDue && !hasOverdue && <span className="w-1 h-1 bg-due-soon rounded-full" />}
                  </span>
                )}
              </div>
              <ul className="space-y-0.5 overflow-hidden">
                {cell.filings.slice(0, 3).map((f) => (
                  <li
                    key={f.id}
                    className={`text-[10px] leading-tight truncate border-l-2 pl-1.5 ${
                      f.status === 'overdue'
                        ? 'border-signal text-signal'
                        : f.status === 'filed'
                          ? 'border-filed text-filed line-through'
                          : f.status === 'due-today' || f.status === 'due-this-week'
                            ? 'border-due-soon text-ink'
                            : 'border-ink-muted/50 text-ink-soft'
                    }`}
                  >
                    <span className="font-mono tracking-tabular">{f.lawCode}</span>
                    <span className="font-sans ml-1">{f.clientName}</span>
                  </li>
                ))}
                {cell.filings.length > 3 && (
                  <li className="text-[9px] uppercase tracking-eyebrow text-ink-muted font-sans">
                    + {cell.filings.length - 3} more
                  </li>
                )}
              </ul>
            </button>
          );
        })}
      </div>
    </div>
  );
}
