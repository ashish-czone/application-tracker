import { type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';

export interface ActiveFilter {
  /** Stable key used for React + removal. Usually `${field}:${value}`. */
  key: string;
  /** Short group label, e.g. "Framework". Rendered in eyebrow small-caps. */
  group: ReactNode;
  /** Value label, e.g. "SOC 2". */
  value: ReactNode;
  onRemove: () => void;
}

export interface ActiveFilterChipsProps {
  filters: ActiveFilter[];
  onClearAll?: () => void;
  className?: string;
}

/**
 * Horizontal row of removable chips summarising the currently applied
 * filters. Each chip reads "GROUP: value ×". Rendered below the FilterBar
 * so users always see what's narrowing the list — rescues discoverability
 * lost by moving filters into popovers.
 */
export function ActiveFilterChips({ filters, onClearAll, className }: ActiveFilterChipsProps) {
  if (filters.length === 0) return null;

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 flex-wrap py-2 border-b border-rule',
        className,
      )}
    >
      <span className="text-[10px] uppercase tracking-eyebrow text-ink-muted font-sans mr-1">
        Applied
      </span>
      {filters.map((f) => (
        <button
          key={f.key}
          type="button"
          onClick={f.onRemove}
          className="inline-flex items-center gap-1.5 px-2 py-[3px] border border-ink bg-paper-raised text-[10px] font-sans uppercase tracking-[0.14em] text-ink hover:bg-ink hover:text-paper-raised transition-colors group"
        >
          <span className="text-ink-muted group-hover:text-paper-raised/70 font-semibold">
            {f.group}
          </span>
          <span className="text-ink group-hover:text-paper-raised">{f.value}</span>
          <X className="w-3 h-3 opacity-70 group-hover:opacity-100" strokeWidth={2} />
        </button>
      ))}
      {onClearAll && filters.length > 1 && (
        <button
          type="button"
          onClick={onClearAll}
          className="ml-1 text-[10px] font-sans font-medium uppercase tracking-eyebrow text-ink-muted hover:text-signal underline-offset-4 hover:underline"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
