import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@packages/ui';

export interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  /** Internal padding. `none` lets the consumer manage spacing (e.g. when mixing multiple stacked sections separated by `border-t`). */
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const PADDING: Record<NonNullable<PanelProps['padding']>, string> = {
  none: '',
  sm: 'p-5',
  md: 'p-6',
  lg: 'p-8',
};

/**
 * Flat instrument-themed panel. `bg-paper-raised` on a hairline rule, no
 * shadow, no rounded corners — the newspaper column of the Compliance UI.
 */
export const Panel = forwardRef<HTMLDivElement, PanelProps>(
  ({ className, padding = 'none', ...props }, ref) => (
    <div
      ref={ref}
      className={cn('bg-paper-raised border border-rule', PADDING[padding], className)}
      {...props}
    />
  ),
);
Panel.displayName = 'Panel';
