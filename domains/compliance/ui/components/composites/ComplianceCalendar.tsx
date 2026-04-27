import { useState, useMemo, type HTMLAttributes } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Eyebrow, useSlidingHighlight } from '@packages/ui';
import type { Filing } from '../../types';

export interface ComplianceCalendarProps extends HTMLAttributes<HTMLDivElement> {
  filings: Filing[];
  /** Initial anchor date — defaults to current. */
  month?: Date;
  /** Handler invoked when a specific filing row is clicked. */
  onFilingClick?: (filing: Filing) => void;
}

type CalendarView = 'month' | 'week';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface Cell {
  date: Date;
  inRange: boolean;
  filings: Filing[];
  isToday: boolean;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function buildMonthCells(anchor: Date, filings: Filing[]): Cell[] {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const first = new Date(year, month, 1);
  const leading = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - leading);
  const cells: Cell[] = [];
  const today = new Date();
  for (let i = 0; i < 42; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const dayFilings = filings.filter((f) => sameDay(new Date(f.dueDate), date));
    cells.push({ date, inRange: date.getMonth() === month, filings: dayFilings, isToday: sameDay(today, date) });
  }
  return cells;
}

function buildWeekCells(anchor: Date, filings: Filing[]): Cell[] {
  // Monday-based week containing the anchor date
  const day = anchor.getDay();
  const mondayOffset = (day + 6) % 7;
  const monday = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - mondayOffset);
  const cells: Cell[] = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    const dayFilings = filings.filter((f) => sameDay(new Date(f.dueDate), date));
    cells.push({ date, inRange: true, filings: dayFilings, isToday: sameDay(today, date) });
  }
  return cells;
}

function shiftAnchor(anchor: Date, view: CalendarView, direction: -1 | 1): Date {
  if (view === 'month') {
    return new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1);
  }
  const d = new Date(anchor);
  d.setDate(d.getDate() + direction * 7);
  return d;
}

function formatHeading(anchor: Date, view: CalendarView): string {
  if (view === 'month') {
    return anchor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
  const day = anchor.getDay();
  const mondayOffset = (day + 6) % 7;
  const monday = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmtDay = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const year = sunday.getFullYear();
  return `${fmtDay(monday)} – ${fmtDay(sunday)}, ${year}`;
}

/**
 * Month/week calendar rendered like a newspaper TV listing. Days are tall
 * cells with hairline borders. Filings inside a day are rendered as small
 * typeset rows (code · client). Includes prev/next navigation and a
 * month/week view toggle.
 */
export function ComplianceCalendar({
  filings,
  month,
  onFilingClick,
  className = '',
  ...rest
}: ComplianceCalendarProps) {
  const [anchor, setAnchor] = useState<Date>(() => month ?? new Date());
  const [view, setView] = useState<CalendarView>('month');
  const viewHighlight = useSlidingHighlight<CalendarView>(view);

  const cells = useMemo(
    () => (view === 'month' ? buildMonthCells(anchor, filings) : buildWeekCells(anchor, filings)),
    [anchor, filings, view],
  );

  const heading = formatHeading(anchor, view);
  const maxVisible = view === 'week' ? 6 : 3;
  const rows = view === 'month' ? 6 : 1;

  const goToday = () => setAnchor(month ?? new Date());

  return (
    <div className={`bg-paper-raised border border-rule ${className}`} {...rest}>
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-rule">
        <div className="flex items-center gap-4">
          <div>
            <Eyebrow tone="muted">Filing Calendar</Eyebrow>
            <h3 className="font-serif text-2xl text-ink leading-none mt-1">{heading}</h3>
          </div>
          <div className="flex items-center gap-1 ml-2">
            <button
              type="button"
              onClick={() => setAnchor((a) => shiftAnchor(a, view, -1))}
              className="w-7 h-7 flex items-center justify-center border border-rule hover:border-ink text-ink-muted hover:text-ink transition-colors"
              aria-label={view === 'month' ? 'Previous month' : 'Previous week'}
            >
              <ChevronLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={goToday}
              className="px-2.5 h-7 border border-rule hover:border-ink text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted hover:text-ink transition-colors"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setAnchor((a) => shiftAnchor(a, view, 1))}
              className="w-7 h-7 flex items-center justify-center border border-rule hover:border-ink text-ink-muted hover:text-ink transition-colors"
              aria-label={view === 'month' ? 'Next month' : 'Next week'}
            >
              <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* View toggle */}
          <div ref={viewHighlight.containerRef} className="relative flex border border-rule">
            {viewHighlight.rect && (
              <motion.div
                aria-hidden
                className="absolute top-0 bottom-0 bg-ink"
                initial={false}
                animate={{ left: viewHighlight.rect.left, width: viewHighlight.rect.width }}
                transition={viewHighlight.transition}
              />
            )}
            {(['month', 'week'] as const).map((v) => (
              <button
                key={v}
                ref={(el) => viewHighlight.setItemRef(v, el)}
                type="button"
                onClick={() => setView(v)}
                className={`relative z-10 px-3 h-7 text-[10px] uppercase tracking-eyebrow font-sans font-medium transition-colors ${
                  view === v ? 'text-paper' : 'text-ink-muted hover:text-ink'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          {/* Legend */}
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
      </div>

      {/* ─── Weekday headers ────────────────────────────────────────── */}
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

      {/* ─── Day cells ──────────────────────────────────────────────── */}
      <div className={`grid grid-cols-7 ${view === 'month' ? 'grid-rows-6' : 'grid-rows-1'}`}>
        {cells.map((cell, i) => {
          const hasOverdue = cell.filings.some((f) => f.status === 'overdue');
          const hasDue = cell.filings.some((f) => f.status === 'due-today' || f.status === 'due-this-week');
          const isLastRow = view === 'month' ? i >= 35 : true;
          return (
            <div
              key={i}
              className={`group relative text-left px-2 pt-2 pb-2 border-r border-b border-rule/40 ${
                view === 'week' ? 'min-h-[280px]' : 'min-h-[84px]'
              } ${!cell.inRange ? 'bg-paper-sunken/30' : ''} ${cell.isToday ? 'bg-due-soon-soft/40' : ''}`}
              style={{
                borderRightWidth: (i + 1) % 7 === 0 ? 0 : 1,
                borderBottomWidth: isLastRow ? 0 : 1,
              }}
            >
              <div className="flex items-start justify-between mb-1">
                <span
                  className={`font-mono tabular-nums text-[13px] leading-none ${
                    cell.inRange ? 'text-ink' : 'text-ink-muted/60'
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
                {cell.filings.slice(0, maxVisible).map((f) => (
                  <li
                    key={f.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onFilingClick?.(f)}
                    onKeyDown={(e) => { if (e.key === 'Enter') onFilingClick?.(f); }}
                    className={`text-[10px] leading-tight truncate border-l-2 pl-1.5 cursor-pointer hover:underline ${
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
                {cell.filings.length > maxVisible && (
                  <li className="text-[9px] uppercase tracking-eyebrow text-ink-muted font-sans">
                    + {cell.filings.length - maxVisible} more
                  </li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
