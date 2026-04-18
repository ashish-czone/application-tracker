import { forwardRef, type HTMLAttributes } from 'react';
import { cn, Eyebrow } from '@packages/ui';

export interface DueDateBlockProps extends HTMLAttributes<HTMLDivElement> {
  date: Date | string;
  /** Explicit urgency tint — if omitted, computed from days-until. */
  tone?: 'overdue' | 'due' | 'soon' | 'far';
  /** Optional "today" used for testing / mock data — defaults to new Date(). */
  referenceDate?: Date;
  /** Extra-compact layout for list cells. */
  compact?: boolean;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function ordinal(n: number): string {
  if (n >= 11 && n <= 13) return 'th';
  const r = n % 10;
  return r === 1 ? 'st' : r === 2 ? 'nd' : r === 3 ? 'rd' : 'th';
}

function daysBetween(a: Date, b: Date): number {
  const ms = b.setHours(0, 0, 0, 0) - a.setHours(0, 0, 0, 0);
  return Math.round(ms / 86_400_000);
}

/**
 * The hero deadline display — used on filing task cards, drawers, and detail
 * views. Enormous ordinal day number, weekday, month/year, plus a "days until"
 * countdown rendered as a sentence. The entire block tints based on urgency.
 */
export const DueDateBlock = forwardRef<HTMLDivElement, DueDateBlockProps>(
  ({ date, tone, referenceDate, compact = false, className, ...rest }, ref) => {
    const d = typeof date === 'string' ? new Date(date) : new Date(date);
    const today = referenceDate ? new Date(referenceDate) : new Date();
    const deltaDays = daysBetween(new Date(today), new Date(d));

    const resolvedTone: NonNullable<DueDateBlockProps['tone']> =
      tone ??
      (deltaDays < 0 ? 'overdue' : deltaDays === 0 ? 'due' : deltaDays <= 7 ? 'soon' : 'far');

    const toneClass =
      resolvedTone === 'overdue'
        ? 'text-signal'
        : resolvedTone === 'due'
          ? 'text-signal'
          : resolvedTone === 'soon'
            ? 'text-due-soon'
            : 'text-ink';

    const countdown =
      deltaDays === 0
        ? 'due today'
        : deltaDays < 0
          ? `overdue by ${Math.abs(deltaDays)} day${Math.abs(deltaDays) === 1 ? '' : 's'}`
          : `in ${deltaDays} day${deltaDays === 1 ? '' : 's'}`;

    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex flex-col items-start',
          compact ? 'gap-0' : 'gap-1',
          className,
        )}
        {...rest}
      >
        <Eyebrow tone="muted" className={cn(compact ? 'mb-0' : 'mb-1')}>
          {WEEKDAYS[d.getDay()]}
        </Eyebrow>
        <div className={cn('flex items-baseline leading-none', toneClass)}>
          <span
            className={cn(
              'font-mono tabular-nums font-medium tracking-[-0.02em]',
              compact ? 'text-4xl' : 'text-[64px]',
            )}
          >
            {d.getDate()}
          </span>
          <sup
            className={cn(
              'font-mono tabular-nums font-medium opacity-80',
              compact ? 'text-xs ml-[1px]' : 'text-xl ml-[2px]',
            )}
          >
            {ordinal(d.getDate())}
          </sup>
          <span
            className={cn(
              'font-serif italic text-ink ml-3',
              compact ? 'text-sm' : 'text-2xl',
            )}
          >
            {MONTHS[d.getMonth()]}
            <span className="font-mono not-italic ml-2 text-ink-soft">
              {String(d.getFullYear()).slice(-2)}
            </span>
          </span>
        </div>
        <div
          className={cn(
            'font-serif italic text-ink-soft mt-0.5',
            compact ? 'text-[11px]' : 'text-sm',
            resolvedTone === 'overdue' && 'text-signal',
          )}
        >
          {countdown}
        </div>
      </div>
    );
  },
);
DueDateBlock.displayName = 'DueDateBlock';
