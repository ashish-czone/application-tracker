import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '../lib/utils';

export interface PageProgressProps extends HTMLAttributes<HTMLDivElement> {
  /** 0–100. If `indeterminate` is true, this is ignored. */
  value?: number;
  indeterminate?: boolean;
  /** Color tone — default matches the theme authority accent. */
  tone?: 'authority' | 'signal' | 'filed';
}

const TONE: Record<NonNullable<PageProgressProps['tone']>, string> = {
  authority: 'bg-authority',
  signal: 'bg-signal',
  filed: 'bg-filed',
};

/**
 * 1px top-of-page progress bar (NYT-style). Used for route transitions and
 * long-running actions. Doesn't take up layout space — fixed to viewport top.
 */
export const PageProgress = forwardRef<HTMLDivElement, PageProgressProps>(
  ({ value = 0, indeterminate = false, tone = 'authority', className, ...rest }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('fixed top-0 left-0 right-0 z-50 h-[2px] overflow-hidden pointer-events-none', className)}
        {...rest}
      >
        {indeterminate ? (
          <div className={cn('h-full w-1/3 animate-[rule-draw_1.2s_ease-in-out_infinite]', TONE[tone])} />
        ) : (
          <div
            className={cn('h-full transition-[width] duration-300 ease-out', TONE[tone])}
            style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
          />
        )}
      </div>
    );
  },
);
PageProgress.displayName = 'PageProgress';
