import type { ReactNode } from 'react';
import { cn } from '@packages/ui';

export interface PanelHeadingProps {
  title: ReactNode;
  subtitle?: ReactNode;
  className?: string;
}

/**
 * Serif title + muted subtitle, stacked tight. Used inside a `Panel` as the
 * heading of a control group (Dialog, Sheet, Slider, Radio, Checkbox, …).
 */
export function PanelHeading({ title, subtitle, className }: PanelHeadingProps) {
  return (
    <div className={cn('space-y-1', className)}>
      <div className="font-serif text-xl text-ink leading-tight">{title}</div>
      {subtitle ? <p className="text-xs text-ink-muted">{subtitle}</p> : null}
    </div>
  );
}
