import { useMemo, useState, type ReactNode } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '@packages/ui';

export interface TypeaheadFilterOption {
  value: string;
  label: ReactNode;
}

export interface TypeaheadFilterPopoverProps {
  /** Trigger label, e.g. "Client". */
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  /** Server-side search results for the current `searchValue`. */
  searchResults: TypeaheadFilterOption[];
  /**
   * Labels for currently-selected ids. Rendered above the search results so
   * a selected option stays visible even when the typed query no longer
   * matches it. Caller fetches these via `useClientOptions({ ids: value })`
   * etc. — the popover doesn't fetch anything itself.
   */
  selectedLabels: TypeaheadFilterOption[];
  searchValue: string;
  onSearchChange: (q: string) => void;
  isLoading?: boolean;
  searchPlaceholder?: string;
  align?: 'start' | 'center' | 'end';
  className?: string;
}

/**
 * Multi-select popover backed by server-driven typeahead. Sister to
 * `<FilterPopover>` (which is for static client-side options), but shifts
 * filtering to the server: the caller supplies `searchValue +
 * onSearchChange` along with `searchResults` from a typeahead hook
 * (`useClientOptions`, `useLawOptions`, …).
 *
 * Why this lives in compliance/ui rather than packages/ui: the typeahead
 * shape is currently used by exactly one feature (the FilingsPage filter
 * dropdowns); promoting it to packages/ui without a second consumer would
 * be premature platform plumbing. If a second domain adopts the pattern,
 * this becomes the right time to lift it.
 */
export function TypeaheadFilterPopover({
  label,
  value,
  onChange,
  searchResults,
  selectedLabels,
  searchValue,
  onSearchChange,
  isLoading,
  searchPlaceholder = 'Search…',
  align = 'start',
  className,
}: TypeaheadFilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const selectedCount = value.length;

  // Layout: selected chips (with their labels resolved by the caller) at the
  // top, then the live search results minus anything already in the
  // selected list (avoid duplicates when a user types a substring of a
  // selected option).
  const selectedSet = useMemo(() => new Set(value), [value]);
  const selectedView = useMemo(
    () => selectedLabels.filter((o) => selectedSet.has(o.value)),
    [selectedLabels, selectedSet],
  );
  const resultsView = useMemo(
    () => searchResults.filter((o) => !selectedSet.has(o.value)),
    [searchResults, selectedSet],
  );

  const toggle = (v: string) => {
    if (selectedSet.has(v)) onChange(value.filter((x) => x !== v));
    else onChange([...value, v]);
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
          className="z-50 w-72 bg-paper-raised border border-ink shadow-[4px_4px_0_0_rgba(0,0,0,0.08)] focus:outline-none"
        >
          <div className="flex items-center gap-2 px-3 py-2 border-b border-rule">
            <Search className="w-3.5 h-3.5 text-ink-muted flex-none" strokeWidth={1.5} />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent outline-none text-sm text-ink placeholder:text-ink-muted font-sans"
            />
          </div>
          <ul className="max-h-72 overflow-y-auto py-1" role="listbox" aria-multiselectable>
            {selectedView.length > 0 && (
              <>
                {selectedView.map((opt) => (
                  <OptionRow
                    key={`sel-${opt.value}`}
                    option={opt}
                    checked
                    onToggle={() => toggle(opt.value)}
                  />
                ))}
                <li className="border-t border-rule/60 mx-3 my-1" aria-hidden />
              </>
            )}
            {isLoading ? (
              <li className="px-3 py-2 text-xs text-ink-muted font-sans italic">Loading…</li>
            ) : resultsView.length === 0 && selectedView.length === 0 ? (
              <li className="px-3 py-2 text-xs text-ink-muted font-sans italic">
                {searchValue ? 'No matches' : 'Type to search'}
              </li>
            ) : (
              resultsView.map((opt) => (
                <OptionRow key={opt.value} option={opt} checked={false} onToggle={() => toggle(opt.value)} />
              ))
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

interface OptionRowProps {
  option: TypeaheadFilterOption;
  checked: boolean;
  onToggle: () => void;
}

function OptionRow({ option, checked, onToggle }: OptionRowProps) {
  return (
    <li>
      <button
        type="button"
        role="option"
        aria-selected={checked}
        onClick={onToggle}
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
        <span className="flex-1 truncate">{option.label}</span>
      </button>
    </li>
  );
}
