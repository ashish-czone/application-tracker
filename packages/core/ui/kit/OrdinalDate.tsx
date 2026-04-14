import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '../lib/utils';

export interface OrdinalDateProps extends HTMLAttributes<HTMLSpanElement> {
  date: Date | string;
  /** "long" = "14ᵗʰ April 2026", "short" = "14 Apr", "numeric" = "14.04.26" */
  variant?: 'long' | 'short' | 'numeric';
  /** Render the weekday prefix (e.g. "Tue · 14ᵗʰ April"). */
  withWeekday?: boolean;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function ordinalSuffix(n: number): string {
  if (n >= 11 && n <= 13) return 'th';
  switch (n % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

/**
 * Renders a date with a real ordinal suffix — the editorial date display
 * used throughout the Instrument theme. "14ᵗʰ April 2026" with a proper
 * <sup> on the ordinal (not a lowercase faux-sup).
 */
export const OrdinalDate = forwardRef<HTMLSpanElement, OrdinalDateProps>(
  ({ date, variant = 'long', withWeekday = false, className, ...rest }, ref) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const day = d.getDate();
    const month = d.getMonth();
    const year = d.getFullYear();

    if (variant === 'numeric') {
      const yy = String(year).slice(-2);
      const mm = String(month + 1).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      return (
        <span ref={ref} className={cn('font-mono tabular-nums text-ink', className)} {...rest}>
          {dd}.{mm}.{yy}
        </span>
      );
    }

    const weekday = withWeekday ? `${WEEKDAYS[d.getDay()]} · ` : '';
    const monthName = variant === 'short' ? MONTHS_SHORT[month] : MONTHS[month];

    return (
      <span ref={ref} className={cn('text-ink', className)} {...rest}>
        {weekday}
        <span className="font-mono tabular-nums">{day}</span>
        <sup className="text-[0.55em] font-mono tabular-nums -top-[0.6em] ml-[1px]">{ordinalSuffix(day)}</sup>{' '}
        <span className="font-serif italic">{monthName}</span>
        {variant === 'long' && <span className="font-mono tabular-nums ml-1.5">{year}</span>}
      </span>
    );
  },
);
OrdinalDate.displayName = 'OrdinalDate';
