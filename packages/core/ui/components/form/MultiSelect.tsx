import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useComboboxState, type ComboboxOption } from '../../hooks/useComboboxState';

export interface MultiSelectProps {
  /** Currently selected values. */
  value: string[];
  /** Called with the new array when chips are added or removed. */
  onChange: (values: string[]) => void;
  /** Static options filtered client-side. */
  options?: ComboboxOption[];
  /** Async search callback. Used when `options` is omitted. */
  onSearch?: (query: string) => Promise<ComboboxOption[]>;
  /**
   * Pre-resolved options for the already-selected values. Seeds the label
   * cache so chips render immediately (useful for lookup fields).
   */
  initialSelected?: ComboboxOption[];
  placeholder?: string;
  disabled?: boolean;
  hasError?: boolean;
  /** Container id — useful for labelling from outside. */
  id?: string;
  /** Optional aria-describedby passed through to the container. */
  'aria-describedby'?: string;
  /** Called when the input loses focus. */
  onBlur?: () => void;
  className?: string;
}

/**
 * Multi-select chip/tag input built on the shared `useComboboxState`
 * engine. Selected values render as small-caps chips above a search
 * input; typing filters the dropdown and Enter/click adds a chip.
 *
 * This is a standalone primitive — `FormChipInput` wraps it for
 * react-hook-form.
 */
export const MultiSelect = React.forwardRef<HTMLDivElement, MultiSelectProps>(
  (
    {
      value,
      onChange,
      options,
      onSearch,
      initialSelected,
      placeholder = 'Search and add...',
      disabled,
      hasError,
      id,
      onBlur,
      className,
      ...rest
    },
    ref,
  ) => {
    const [open, setOpen] = React.useState(false);
    const [labelCache, setLabelCache] = React.useState<Map<string, ComboboxOption>>(() => {
      const map = new Map<string, ComboboxOption>();
      if (initialSelected) for (const o of initialSelected) map.set(o.value, o);
      return map;
    });
    const containerRef = React.useRef<HTMLDivElement>(null);
    const inputRef = React.useRef<HTMLInputElement>(null);

    // Seed label cache when static options are provided
    React.useEffect(() => {
      if (!options) return;
      setLabelCache((prev) => {
        const next = new Map(prev);
        for (const opt of options) {
          if (!next.has(opt.value)) next.set(opt.value, opt);
        }
        return next;
      });
    }, [options]);

    const selectedSet = React.useMemo(() => new Set(value), [value]);

    const { search, setSearch, isSearching, displayOptions } = useComboboxState({
      options,
      onSearch,
      isOpen: open,
      filter: (opt) => !selectedSet.has(opt.value),
    });

    const addValue = (opt: ComboboxOption) => {
      setLabelCache((prev) => new Map(prev).set(opt.value, opt));
      onChange([...value, opt.value]);
      setSearch('');
      inputRef.current?.focus();
    };

    const removeValue = (val: string) => {
      onChange(value.filter((v) => v !== val));
    };

    // Close on outside click
    React.useEffect(() => {
      const handler = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setOpen(false);
        }
      };
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleMerged = (node: HTMLDivElement | null) => {
      containerRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    };

    return (
      <div ref={handleMerged} className={cn('relative', className)} {...rest}>
        <div
          data-slot="multi-select-trigger"
          aria-invalid={hasError || undefined}
          className={cn(
            'flex flex-wrap items-center gap-1 min-h-[40px] w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm ring-offset-background',
            'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
            hasError && 'border-destructive',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
          onClick={() => !disabled && inputRef.current?.focus()}
        >
          {value.map((val) => {
            const opt = labelCache.get(val);
            return (
              <span
                key={val}
                data-slot="chip"
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                style={
                  opt?.color
                    ? { backgroundColor: `${opt.color}20`, color: opt.color }
                    : { backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }
                }
              >
                {opt?.label ?? val}
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeValue(val);
                    }}
                    className="ml-0.5 rounded-full hover:bg-black/10 p-0.5"
                    aria-label={`Remove ${opt?.label ?? val}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            );
          })}

          <input
            ref={inputRef}
            id={id}
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              setTimeout(() => setOpen(false), 150);
              onBlur?.();
            }}
            placeholder={value.length === 0 ? placeholder : ''}
            disabled={disabled}
            className="flex-1 min-w-[80px] bg-transparent outline-none text-sm placeholder:text-muted-foreground"
            autoComplete="off"
          />
        </div>

        {open && (isSearching || displayOptions.length > 0 || search || onSearch) && (
          <div
            data-slot="multi-select-content"
            className="absolute z-50 mt-1 w-full rounded-md border border-input bg-popover shadow-md max-h-48 overflow-y-auto"
          >
            {isSearching ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">Searching...</p>
            ) : displayOptions.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                {onSearch && !search ? 'Type to search...' : 'No results found'}
              </p>
            ) : (
              displayOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => addValue(opt)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors flex items-center gap-2"
                >
                  {opt.color && (
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ backgroundColor: opt.color }}
                    />
                  )}
                  {opt.label}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    );
  },
);
MultiSelect.displayName = 'MultiSelect';

export type { ComboboxOption } from '../../hooks/useComboboxState';
