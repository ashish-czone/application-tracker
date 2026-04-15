import * as React from 'react';
import { cn } from '../../lib/utils';

export interface NumberFormatProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children' | 'prefix'> {
  /** The value to format. Pass null/undefined to render the fallback. */
  value: number | string | null | undefined;
  /** BCP-47 locale tag. Defaults to browser locale. */
  locale?: string;
  /** Number of fractional digits. */
  decimals?: number;
  /** Minimum number of fractional digits. Overrides `decimals` for the lower bound. */
  minDecimals?: number;
  /** Maximum number of fractional digits. Overrides `decimals` for the upper bound. */
  maxDecimals?: number;
  /** Use thousands grouping. Defaults to true. */
  useGrouping?: boolean;
  /** Render as a percentage — multiplies value by 100 and appends `%`. */
  percent?: boolean;
  /** Compact notation (`1.2K`, `3.4M`). */
  compact?: boolean;
  /** Explicit sign display — "auto" | "always" | "exceptZero" | "never". */
  signDisplay?: 'auto' | 'always' | 'exceptZero' | 'never';
  /** Fallback when value is empty/null/NaN. Defaults to an em-dash. */
  fallback?: React.ReactNode;
  /** Optional prefix like "Δ" or "+". Rendered as-is before the number. */
  prefix?: React.ReactNode;
  /** Optional suffix like "ms" or "pts". */
  suffix?: React.ReactNode;
}

/**
 * Locale-aware number display using `Intl.NumberFormat`. Renders a
 * `data-numeric` span so tabular numerics kick in automatically under
 * `.theme-instrument`.
 */
export const NumberFormat = React.forwardRef<HTMLSpanElement, NumberFormatProps>(
  (
    {
      value,
      locale,
      decimals,
      minDecimals,
      maxDecimals,
      useGrouping = true,
      percent,
      compact,
      signDisplay,
      fallback = '—',
      prefix,
      suffix,
      className,
      ...props
    },
    ref,
  ) => {
    const numeric =
      value == null || value === '' ? NaN : typeof value === 'number' ? value : Number(value);

    if (!Number.isFinite(numeric)) {
      return (
        <span ref={ref} data-slot="number-format" className={cn('text-muted-foreground', className)} {...props}>
          {fallback}
        </span>
      );
    }

    const min = minDecimals ?? decimals ?? (percent ? 0 : 0);
    const max = maxDecimals ?? decimals ?? (percent ? 2 : 2);

    const formatter = new Intl.NumberFormat(locale, {
      style: percent ? 'percent' : 'decimal',
      minimumFractionDigits: min,
      maximumFractionDigits: max,
      useGrouping,
      notation: compact ? 'compact' : 'standard',
      signDisplay,
    });

    return (
      <span
        ref={ref}
        data-slot="number-format"
        data-numeric="true"
        className={cn('tabular-nums', className)}
        {...props}
      >
        {prefix}
        {formatter.format(numeric)}
        {suffix}
      </span>
    );
  },
);
NumberFormat.displayName = 'NumberFormat';
