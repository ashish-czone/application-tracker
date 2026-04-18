import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface FilterChip {
  key: string;
  label: ReactNode;
  active?: boolean;
  /** "rule" (outline) or "solid" (active state). */
  tone?: 'signal' | 'filed' | 'authority' | 'due-soon' | 'ink';
  onRemove?: () => void;
  onClick?: () => void;
}

export interface FilterBarProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  chips: FilterChip[];
  searchValue?: string;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  /** "Saved view" label on the right side. */
  savedView?: string;
  onClearAll?: () => void;
  /** Total count shown at the far right — "38 filings shown". */
  resultCount?: ReactNode;
}

const CHIP_TONE_ACTIVE: Record<NonNullable<FilterChip['tone']>, string> = {
  signal: 'bg-signal text-paper-raised border-signal',
  filed: 'bg-filed text-paper-raised border-filed',
  authority: 'bg-authority text-paper-raised border-authority',
  'due-soon': 'bg-due-soon text-paper-raised border-due-soon',
  ink: 'bg-ink text-paper-raised border-ink',
};

/**
 * Hairline filter bar. Search input on the left (no box — just an underline),
 * chip cluster in the middle, saved view + result count on the right.
 * Chips are rendered as small-caps pills. Active chips get a solid fill.
 */
export const FilterBar = forwardRef<HTMLDivElement, FilterBarProps>(
  (
    {
      chips,
      searchValue = '',
      searchPlaceholder = 'Search…',
      onSearchChange,
      savedView,
      onClearAll,
      resultCount,
      className,
      ...rest
    },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center gap-4 py-3 border-y border-rule',
          className,
        )}
        {...rest}
      >
        <label className="flex items-center gap-2 min-w-[200px] flex-1 max-w-xs border-b border-rule focus-within:border-ink transition-colors pb-1">
          <Search className="w-3.5 h-3.5 text-ink-muted flex-none" strokeWidth={1.5} />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full bg-transparent outline-none text-sm text-ink placeholder:text-ink-muted font-sans"
          />
        </label>

        <div className="flex items-center gap-1.5 flex-wrap flex-1">
          {chips.map((chip) => {
            const isActive = chip.active;
            return (
              <button
                key={chip.key}
                type="button"
                onClick={chip.onClick}
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-[3px] border text-[10px] font-sans font-semibold uppercase tracking-[0.14em] transition-colors',
                  isActive && chip.tone
                    ? CHIP_TONE_ACTIVE[chip.tone]
                    : 'border-rule text-ink-soft bg-paper-raised hover:border-ink hover:text-ink',
                )}
              >
                <span>{chip.label}</span>
                {chip.onRemove && isActive && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      chip.onRemove?.();
                    }}
                    className="ml-0.5 -mr-0.5 opacity-70 hover:opacity-100"
                  >
                    <X className="w-3 h-3" strokeWidth={2} />
                  </span>
                )}
              </button>
            );
          })}
          {onClearAll && chips.some((c) => c.active) && (
            <button
              type="button"
              onClick={onClearAll}
              className="ml-1 text-[10px] font-sans font-medium uppercase tracking-eyebrow text-ink-muted hover:text-signal underline-offset-4 hover:underline"
            >
              Clear all
            </button>
          )}
        </div>

        <div className="flex items-center gap-4 text-[11px] font-sans">
          {savedView && (
            <span className="text-ink-soft">
              <span className="text-ink-muted uppercase tracking-eyebrow mr-1.5">View</span>
              <span className="font-serif italic text-ink">{savedView}</span>
            </span>
          )}
          {resultCount && <span className="font-mono tabular-nums text-ink-soft">{resultCount}</span>}
        </div>
      </div>
    );
  },
);
FilterBar.displayName = 'FilterBar';
