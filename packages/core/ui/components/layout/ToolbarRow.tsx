import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export type ToolbarRowVariant = 'bordered' | 'plain';

export interface ToolbarRowProps {
  /** Left-most slot — typically a `SearchInput`. */
  search?: ReactNode;
  /** Center-left slot — typically `FilterPopover`s. Auto-wrapped with `gap-2`. */
  filters?: ReactNode;
  /** Right-aligned slot — counts, export, column chooser. Auto-wrapped with `gap-3`. */
  trailing?: ReactNode;
  /** `bordered` adds `py-3 border-b border-rule`. Default: `bordered`. */
  variant?: ToolbarRowVariant;
  className?: string;
}

export function ToolbarRow({
  search,
  filters,
  trailing,
  variant = 'bordered',
  className,
}: ToolbarRowProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3',
        variant === 'bordered' && 'py-3 border-b border-rule',
        className,
      )}
    >
      {search}
      {filters && <div className="flex items-center gap-2">{filters}</div>}
      {trailing && <div className="ml-auto flex items-center gap-3">{trailing}</div>}
    </div>
  );
}
