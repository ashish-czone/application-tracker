import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface DetailRowProps {
  label: string;
  value?: ReactNode;
  mono?: boolean;
  children?: ReactNode;
  className?: string;
}

export function DetailRow({ label, value, mono, children, className }: DetailRowProps) {
  return (
    <div className={className}>
      <div className="text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted mb-1">
        {label}
      </div>
      {children ?? (
        <div
          className={cn(
            'text-sm text-ink',
            mono ? 'font-mono tracking-tabular uppercase' : 'font-sans',
          )}
        >
          {value}
        </div>
      )}
    </div>
  );
}
