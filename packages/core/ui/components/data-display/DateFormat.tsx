import * as React from 'react';
import { format, parseISO, isValid, formatRelative } from 'date-fns';
import { cn } from '../../lib/utils';

export interface DateFormatProps extends Omit<React.HTMLAttributes<HTMLTimeElement>, 'children' | 'prefix'> {
  /** ISO string (`2026-04-15T14:30:00Z`), `YYYY-MM-DD`, Date, or number (epoch ms). */
  value: string | Date | number | null | undefined;
  /**
   * date-fns format string. Defaults to `PPP` for dates, `PPp` when time is
   * included, or `relative` for a relative-to-now rendering.
   */
  format?: string | 'relative' | 'short' | 'medium' | 'long' | 'date' | 'datetime';
  /** Fallback when value is empty/null/invalid. Defaults to an em-dash. */
  fallback?: React.ReactNode;
  /** Optional prefix, e.g. "Filed" → "Filed 3 days ago". */
  prefix?: React.ReactNode;
}

const FORMAT_PRESETS: Record<string, string> = {
  short: 'MMM d',
  medium: 'MMM d, yyyy',
  long: 'PPP',
  date: 'PPP',
  datetime: 'PPp',
};

function parseValue(value: DateFormatProps['value']): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return isValid(value) ? value : null;
  if (typeof value === 'number') {
    const d = new Date(value);
    return isValid(d) ? d : null;
  }
  // string — try ISO first, then YYYY-MM-DD
  const iso = parseISO(value);
  if (isValid(iso)) return iso;
  return null;
}

/**
 * Locale-aware date display. Uses date-fns under the hood and wraps the
 * output in a semantic `<time dateTime>`. Tabular numerics are styled
 * automatically under `.theme-instrument` via the `data-slot` hook.
 */
export const DateFormat = React.forwardRef<HTMLTimeElement, DateFormatProps>(
  ({ value, format: fmt = 'medium', fallback = '—', prefix, className, ...props }, ref) => {
    const parsed = parseValue(value);

    if (!parsed) {
      return (
        <time ref={ref} data-slot="date-format" className={cn('text-muted-foreground', className)} {...props}>
          {fallback}
        </time>
      );
    }

    let rendered: string;
    if (fmt === 'relative') {
      rendered = formatRelative(parsed, new Date());
    } else {
      const pattern = FORMAT_PRESETS[fmt] ?? fmt;
      rendered = format(parsed, pattern);
    }

    return (
      <time
        ref={ref}
        data-slot="date-format"
        dateTime={parsed.toISOString()}
        className={cn(className)}
        {...props}
      >
        {prefix ? <>{prefix} </> : null}
        {rendered}
      </time>
    );
  },
);
DateFormat.displayName = 'DateFormat';
