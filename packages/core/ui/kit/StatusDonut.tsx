import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '../lib/utils';
import { Eyebrow } from './Eyebrow';

export interface StatusDonutSegment {
  key: string;
  label: string;
  value: number;
  /** CSS color — usually `hsl(var(--filed))` etc. */
  color: string;
}

export interface StatusDonutProps extends HTMLAttributes<HTMLDivElement> {
  segments: StatusDonutSegment[];
  /** The big center number. If omitted, renders "%" of the first segment vs total. */
  centerValue?: string;
  /** Small label under the center value. */
  centerLabel?: string;
  size?: number;
  /** Stroke thickness. Hairline-ish looks best: 10–14. */
  thickness?: number;
  /** Show the legend below the donut. */
  showLegend?: boolean;
}

/**
 * Thin-stroke donut chart, hand-rolled SVG (no Recharts for this — keeps it
 * crisp and lets us control stroke geometry exactly). Segments are drawn as
 * arcs on a shared circle with small gaps between them. Center shows a big
 * mono number and a small-caps label.
 */
export const StatusDonut = forwardRef<HTMLDivElement, StatusDonutProps>(
  (
    {
      segments,
      centerValue,
      centerLabel,
      size = 196,
      thickness = 12,
      showLegend = true,
      className,
      ...rest
    },
    ref,
  ) => {
    const total = segments.reduce((acc, s) => acc + s.value, 0) || 1;
    const radius = (size - thickness) / 2;
    const cx = size / 2;
    const cy = size / 2;
    const circumference = 2 * Math.PI * radius;
    const gap = 3; // px gap between segments

    let offset = 0;
    const arcs = segments.map((segment) => {
      const fraction = segment.value / total;
      const len = Math.max(circumference * fraction - gap, 0);
      const arc = {
        ...segment,
        dashArray: `${len} ${circumference - len}`,
        dashOffset: -offset,
      };
      offset += len + gap;
      return arc;
    });

    const computedCenter =
      centerValue ?? `${Math.round((segments[0]?.value / total) * 100)}%`;

    return (
      <div
        ref={ref}
        className={cn('flex flex-col items-center', className)}
        {...rest}
      >
        <div className="relative" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="-rotate-90">
            {/* Background ring */}
            <circle
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke="hsl(var(--rule))"
              strokeWidth={thickness}
              opacity={0.35}
            />
            {arcs.map((arc) => (
              <circle
                key={arc.key}
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                stroke={arc.color}
                strokeWidth={thickness}
                strokeDasharray={arc.dashArray}
                strokeDashoffset={arc.dashOffset}
                strokeLinecap="butt"
                className="transition-all"
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            <span className="font-mono tabular-nums text-4xl font-medium text-ink leading-none">
              {computedCenter}
            </span>
            {centerLabel && <Eyebrow tone="muted">{centerLabel}</Eyebrow>}
          </div>
        </div>
        {showLegend && (
          <ul className="mt-5 w-full grid grid-cols-2 gap-x-4 gap-y-2">
            {segments.map((s) => (
              <li key={s.key} className="flex items-center gap-2 text-xs">
                <span
                  aria-hidden
                  className="inline-block w-2.5 h-2.5 flex-none"
                  style={{ backgroundColor: s.color }}
                />
                <span className="text-ink-soft font-sans flex-1 truncate">{s.label}</span>
                <span className="font-mono tabular-nums text-ink text-[11px]">
                  {Math.round((s.value / total) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  },
);
StatusDonut.displayName = 'StatusDonut';
