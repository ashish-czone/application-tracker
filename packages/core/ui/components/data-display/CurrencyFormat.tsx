import * as React from 'react';
import { cn } from '../../lib/utils';

export interface CurrencyFormatProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
  /**
   * The amount in **minor units** (cents) by default. Per project data-formatting
   * rules, currency is stored as integer cents — this component assumes that
   * unit unless `minor={false}` is passed.
   */
  value: number | string | null | undefined;
  /** ISO 4217 currency code (USD, EUR, INR, AED...). Defaults to USD. */
  currency?: string;
  /** BCP-47 locale tag. Defaults to browser locale. */
  locale?: string;
  /**
   * Whether `value` is in minor units (cents). Defaults to `true` — pass
   * `false` if the amount is already in major units (1250.50 rather than 125050).
   */
  minor?: boolean;
  /** Number of fractional digits. Defaults to the currency's default (usually 2). */
  decimals?: number;
  /** Currency display style — "symbol" | "narrowSymbol" | "code" | "name". */
  display?: 'symbol' | 'narrowSymbol' | 'code' | 'name';
  /** Compact notation (`$1.2K`). */
  compact?: boolean;
  /** Explicit sign display. */
  signDisplay?: 'auto' | 'always' | 'exceptZero' | 'never';
  /** Fallback when value is empty/null/NaN. Defaults to an em-dash. */
  fallback?: React.ReactNode;
}

const MINOR_UNITS_EXPONENT: Record<string, number> = {
  JPY: 0,
  KRW: 0,
  VND: 0,
  CLP: 0,
  // Default 2 covers USD, EUR, GBP, INR, AED, SGD, CAD, AUD, etc.
};

/**
 * Locale-aware currency display. Follows the project's "integer cents +
 * currency code" storage rule: the `value` prop is in minor units by
 * default. Styled with tabular numerics automatically under the Instrument
 * theme via `data-numeric`.
 */
export const CurrencyFormat = React.forwardRef<HTMLSpanElement, CurrencyFormatProps>(
  (
    {
      value,
      currency = 'USD',
      locale,
      minor = true,
      decimals,
      display = 'symbol',
      compact,
      signDisplay,
      fallback = '—',
      className,
      ...props
    },
    ref,
  ) => {
    const raw = value == null || value === '' ? NaN : typeof value === 'number' ? value : Number(value);

    if (!Number.isFinite(raw)) {
      return (
        <span ref={ref} data-slot="currency-format" className={cn('text-muted-foreground', className)} {...props}>
          {fallback}
        </span>
      );
    }

    const exponent = MINOR_UNITS_EXPONENT[currency.toUpperCase()] ?? 2;
    const major = minor ? raw / Math.pow(10, exponent) : raw;

    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      currencyDisplay: display,
      notation: compact ? 'compact' : 'standard',
      minimumFractionDigits: decimals ?? exponent,
      maximumFractionDigits: decimals ?? exponent,
      signDisplay,
    });

    return (
      <span
        ref={ref}
        data-slot="currency-format"
        data-numeric="true"
        className={cn('tabular-nums', className)}
        {...props}
      >
        {formatter.format(major)}
      </span>
    );
  },
);
CurrencyFormat.displayName = 'CurrencyFormat';
