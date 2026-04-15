import { useMemo, useState, type ReactNode } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '../lib/utils';

export interface FilterPopoverOption {
  value: string;
  label: ReactNode;
  /** Optional count shown right-aligned in small mono type. */
  count?: number;
}

export interface FilterPopoverProps {
  /** Trigger label, e.g. "Framework". */
  label: string;
  options: FilterPopoverOption[];
  /** Currently selected values. */
  value: string[];
  onChange: (next: string[]) => void;
  /** Hide the client-side search input inside the popover. Default shown when options > 8. */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Align popover content to this edge of the trigger. */
  align?: 'start' | 'center' | 'end';
  className?: string;
}

/**
 * A small trigger button that opens a Radix popover with a checkbox list.
 * Multi-select, static client-side options, optional search. Used inside a
 * FilterBar row. Selection count appears as a solid authority pip next to
 * the label when > 0, matching the editorial chip language.
 */
export function FilterPopover({
  label,
  options,
  value,
  onChange,
  searchable,
  searchPlaceholder = 'Search…',
  align = 'start',
  className,
}: FilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const shouldSearch = searchable ?? options.length > 8;

  const filtered = useMemo(() => {
    if (!shouldSearch || !query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter((o) => String(o.label).toLowerCase().includes(q));
  }, [options, shouldSearch, query]);

  const selectedCount = value.length;

  const toggle = (v: string) => {
    if (value.includes(v)) {
      onChange(value.filter((x) => x !== v));
    } else {
      onChange([...value, v]);
    }
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-[5px] border text-[10px] font-sans font-semibold uppercase tracking-[0.14em] transition-colors',
            selectedCount > 0
              ? 'border-ink text-ink bg-paper-raised'
              : 'border-rule text-ink-soft bg-paper-raised hover:border-ink hover:text-ink',
            className,
          )}
        >
          <span>{label}</span>
          {selectedCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[14px] h-[14px] px-1 bg-authority text-paper-raised font-mono tabular-nums text-[9px] leading-none">
              {selectedCount}
            </span>
          )}
          <ChevronDown className="w-3 h-3 -mr-0.5 opacity-70" strokeWidth={2} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align={align}
          sideOffset={6}
          className="z-50 w-56 bg-paper-raised border border-ink shadow-[4px_4px_0_0_rgba(0,0,0,0.08)] focus:outline-none"
        >
          {shouldSearch && (
            <div className="flex items-center gap-2 px-3 py-2 border-b border-rule">
              <Search className="w-3.5 h-3.5 text-ink-muted flex-none" strokeWidth={1.5} />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-transparent outline-none text-sm text-ink placeholder:text-ink-muted font-sans"
              />
            </div>
          )}
          <ul className="max-h-72 overflow-y-auto py-1" role="listbox" aria-multiselectable>
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs text-ink-muted font-sans italic">No matches</li>
            ) : (
              filtered.map((opt) => {
                const checked = value.includes(opt.value);
                return (
                  <li key={opt.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={checked}
                      onClick={() => toggle(opt.value)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm font-sans text-ink hover:bg-paper-sunken/60 transition-colors"
                    >
                      <span
                        className={cn(
                          'w-3.5 h-3.5 flex-none border flex items-center justify-center',
                          checked ? 'bg-ink border-ink' : 'border-rule',
                        )}
                      >
                        {checked && <Check className="w-3 h-3 text-paper-raised" strokeWidth={3} />}
                      </span>
                      <span className="flex-1 truncate">{opt.label}</span>
                      {opt.count !== undefined && (
                        <span className="font-mono tabular-nums text-[11px] text-ink-muted">
                          {opt.count}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
          {selectedCount > 0 && (
            <div className="border-t border-rule px-3 py-1.5 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-eyebrow text-ink-muted font-sans">
                {selectedCount} selected
              </span>
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-[10px] uppercase tracking-eyebrow text-ink-muted hover:text-signal underline-offset-4 hover:underline font-sans"
              >
                Clear
              </button>
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
