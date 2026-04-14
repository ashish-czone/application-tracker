import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '../lib/utils';

export interface SparklineProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  data: number[];
  width?: number;
  height?: number;
  /** "ink" (default), "signal", "filed", "authority", "due-soon". */
  tone?: 'ink' | 'signal' | 'filed' | 'authority' | 'due-soon';
  /** Shade the area beneath the line. */
  area?: boolean;
  /** Show a terminal dot on the last data point. */
  terminalDot?: boolean;
}

const TONE_STROKE: Record<NonNullable<SparklineProps['tone']>, string> = {
  ink: 'hsl(var(--ink-soft))',
  signal: 'hsl(var(--signal))',
  filed: 'hsl(var(--filed))',
  authority: 'hsl(var(--authority))',
  'due-soon': 'hsl(var(--due-soon))',
};

/**
 * Hand-rolled sparkline — raw SVG, one stroked path + optional area fill +
 * optional terminal dot. No axes, no grid, no tooltip. It exists to add a
 * single beat of rhythm to a KPI card. 40×16 default fits inline with numbers.
 */
export const Sparkline = forwardRef<HTMLDivElement, SparklineProps>(
  (
    {
      data,
      width = 72,
      height = 22,
      tone = 'ink',
      area = true,
      terminalDot = true,
      className,
      ...rest
    },
    ref,
  ) => {
    if (!data.length) return null;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const span = max - min || 1;
    const stepX = data.length > 1 ? width / (data.length - 1) : 0;
    const points = data.map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / span) * (height - 4) - 2;
      return [x, y] as const;
    });

    const pathD = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    const areaD = `${pathD} L${width},${height} L0,${height} Z`;
    const [tx, ty] = points[points.length - 1];
    const stroke = TONE_STROKE[tone];

    return (
      <div ref={ref} className={cn('inline-block', className)} {...rest}>
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
          {area && <path d={areaD} fill={stroke} opacity={0.12} />}
          <path d={pathD} fill="none" stroke={stroke} strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" />
          {terminalDot && <circle cx={tx} cy={ty} r={1.75} fill={stroke} />}
        </svg>
      </div>
    );
  },
);
Sparkline.displayName = 'Sparkline';
