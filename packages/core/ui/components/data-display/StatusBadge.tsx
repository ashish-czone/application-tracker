import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

export type StatusBadgeVariant = 'rule' | 'solid';

export interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  label: string;
  /** Optional small-caps leading mark (e.g. "●", "✓", "·"). */
  mark?: ReactNode;
  /** Optional monospace trailing value (e.g. "3 d"). */
  tail?: string;
  /** Container style — `rule` is outlined (default), `solid` is a filled fill. */
  variant?: StatusBadgeVariant;
}

/**
 * Small-caps status chip with an optional leading mark and monospace trailing
 * tail. Color is supplied by the caller via `className` — this primitive owns
 * the shape, typography and tail formatting, but not the palette. Wrappers
 * (e.g. `UrgencyBadge`) map domain states to colors and pass them through.
 */
export const StatusBadge = forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ label, mark, tail, variant = 'rule', className, ...rest }, ref) => {
    return (
      <span
        ref={ref}
        data-variant={variant}
        className={cn(
          'inline-flex items-center gap-1.5 px-2 py-[3px]',
          'text-[10px] font-sans font-semibold uppercase tracking-[0.14em]',
          'border',
          className,
        )}
        {...rest}
      >
        {mark != null && (
          <span aria-hidden className="text-[10px] leading-none">
            {mark}
          </span>
        )}
        <span>{label}</span>
        {tail && (
          <>
            <span aria-hidden className="opacity-50">·</span>
            <span className="font-mono tabular-nums tracking-normal normal-case font-medium">
              {tail}
            </span>
          </>
        )}
      </span>
    );
  },
);
StatusBadge.displayName = 'StatusBadge';
