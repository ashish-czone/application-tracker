import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/utils';
import { Eyebrow } from './Eyebrow';
import { Sparkline, type SparklineProps } from './Sparkline';

export interface MetricKPIProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  /** The big number. Rendered in JetBrains Mono with tabular figures. */
  value: ReactNode;
  /** Units rendered subtle and serif — "filings", "clients", "%". */
  unit?: ReactNode;
  /** Delta like "+18%" or "▲ 3". Auto-colors based on `deltaTone`. */
  delta?: ReactNode;
  deltaTone?: 'positive' | 'negative' | 'neutral' | 'warning';
  /** Small auxiliary footnote under the number. */
  footnote?: ReactNode;
  /** Optional sparkline data to render on the right. */
  sparklineData?: number[];
  sparklineTone?: SparklineProps['tone'];
  /** Tone accent — paints the left hairline rule. */
  accent?: 'signal' | 'authority' | 'filed' | 'due-soon' | 'ink';
  /** Index used by the demo page for staggered reveal motion. */
  index?: number;
}

const ACCENT_RULE: Record<NonNullable<MetricKPIProps['accent']>, string> = {
  signal: 'before:bg-signal',
  authority: 'before:bg-authority',
  filed: 'before:bg-filed',
  'due-soon': 'before:bg-due-soon',
  ink: 'before:bg-ink',
};

const DELTA_COLOR: Record<NonNullable<MetricKPIProps['deltaTone']>, string> = {
  positive: 'text-filed',
  negative: 'text-signal',
  neutral: 'text-ink-soft',
  warning: 'text-due-soon',
};

/**
 * The KPI card used on every dashboard row. Big mono number + small-caps label
 * + a colored left rule (the only place the accent color lives). Optional
 * sparkline and delta. No card chrome — just hairlines. These sit side-by-side
 * in a row with dividing rules.
 */
export const MetricKPI = forwardRef<HTMLDivElement, MetricKPIProps>(
  (
    {
      label,
      value,
      unit,
      delta,
      deltaTone = 'neutral',
      footnote,
      sparklineData,
      sparklineTone,
      accent = 'ink',
      index = 0,
      className,
      style,
      ...rest
    },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          'relative pl-5 pr-4 py-5 bg-paper-raised',
          'before:absolute before:left-0 before:top-5 before:bottom-5 before:w-[2px]',
          ACCENT_RULE[accent],
          'reveal-up',
          className,
        )}
        style={{ animationDelay: `${index * 60}ms`, ...style }}
        {...rest}
      >
        <Eyebrow tone="muted">{label}</Eyebrow>
        <div className="mt-2 flex items-baseline justify-between gap-3">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="font-mono tabular-nums text-4xl font-medium text-ink leading-none tracking-[-0.01em]">
              {value}
            </span>
            {unit && (
              <span className="font-serif italic text-ink-muted text-base leading-none">{unit}</span>
            )}
          </div>
          {sparklineData && (
            <Sparkline data={sparklineData} tone={sparklineTone ?? accent === 'ink' ? 'ink' : accent} />
          )}
        </div>
        {(delta || footnote) && (
          <div className="mt-3 flex items-center justify-between gap-3">
            {footnote && <span className="text-[11px] text-ink-muted font-serif italic">{footnote}</span>}
            {delta && (
              <span
                className={cn(
                  'text-[11px] font-mono tabular-nums font-medium tracking-tabular',
                  DELTA_COLOR[deltaTone],
                )}
              >
                {delta}
              </span>
            )}
          </div>
        )}
      </div>
    );
  },
);
MetricKPI.displayName = 'MetricKPI';
