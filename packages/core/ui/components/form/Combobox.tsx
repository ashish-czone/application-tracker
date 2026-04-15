import * as React from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Command } from 'cmdk';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useComboboxState, type ComboboxOption } from '../../hooks/useComboboxState';

export interface ComboboxProps {
  /** Currently selected value. Empty string / null / undefined = nothing selected. */
  value: string | null | undefined;
  /** Called with the new value when the user picks an option. Pass '' to clear. */
  onChange: (value: string) => void;
  /** Static options filtered client-side. */
  options?: ComboboxOption[];
  /** Async search callback. Used when `options` is omitted. */
  onSearch?: (query: string) => Promise<ComboboxOption[]>;
  /** Initial label shown when the component mounts (useful for lookup fields where only the id is known). */
  initialDisplayValue?: string;
  /** Trigger button placeholder. Shown when nothing is selected. */
  placeholder?: string;
  /** Search input placeholder. */
  searchPlaceholder?: string;
  disabled?: boolean;
  /** Visually mark the trigger as invalid via aria-invalid. */
  hasError?: boolean;
  /** Trigger id — useful for labelling from outside. */
  id?: string;
  /** Optional aria-describedby passed through to the trigger. */
  'aria-describedby'?: string;
  /** Called when the trigger loses focus. */
  onBlur?: () => void;
  className?: string;
}

/**
 * Single-select searchable combobox built on cmdk + Radix Popover. The
 * heavy lifting (search debounce, async results, client filter) lives in
 * `useComboboxState` so `MultiSelect` can reuse the same engine.
 *
 * This is a standalone primitive — `FormSelect` wraps it for react-hook-form.
 */
export const Combobox = React.forwardRef<HTMLButtonElement, ComboboxProps>(
  (
    {
      value,
      onChange,
      options,
      onSearch,
      initialDisplayValue,
      placeholder = 'Select...',
      searchPlaceholder = 'Search...',
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
    const inputRef = React.useRef<HTMLInputElement>(null);
    const [cachedLabel, setCachedLabel] = React.useState<string | undefined>(initialDisplayValue);

    const { search, setSearch, isSearching, displayOptions } = useComboboxState({
      options,
      onSearch,
      isOpen: open,
    });

    // Keep cache in sync with incoming display value (e.g. hydrated from a parent)
    React.useEffect(() => {
      if (initialDisplayValue) setCachedLabel(initialDisplayValue);
    }, [initialDisplayValue]);

    // Keep cache in sync when a matching static option exists
    React.useEffect(() => {
      if (!value || !options) return;
      const match = options.find((o) => o.value === value);
      if (match) setCachedLabel(match.label);
    }, [value, options]);

    // Focus the cmdk input when opening
    React.useEffect(() => {
      if (open) setTimeout(() => inputRef.current?.focus(), 0);
    }, [open]);

    const handleSelect = (opt: ComboboxOption) => {
      const newVal = opt.value === value ? '' : opt.value;
      onChange(newVal);
      setCachedLabel(newVal ? opt.label : undefined);
      setOpen(false);
    };

    return (
      <Popover.Root
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) onBlur?.();
        }}
      >
        <Popover.Trigger asChild disabled={disabled}>
          <button
            ref={ref}
            type="button"
            id={id}
            role="combobox"
            aria-expanded={open}
            aria-invalid={hasError || undefined}
            className={cn(
              'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50',
              !value && 'text-muted-foreground',
              className,
            )}
            {...rest}
          >
            <span className="truncate">{cachedLabel ?? placeholder}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            data-slot="combobox-content"
            className="z-50 w-[var(--radix-popover-trigger-width)] rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in fade-in-0 zoom-in-95"
            sideOffset={4}
            align="start"
          >
            <Command shouldFilter={false}>
              <div className="flex items-center border-b px-3">
                <Command.Input
                  ref={inputRef}
                  value={search}
                  onValueChange={setSearch}
                  placeholder={searchPlaceholder}
                  className="flex h-9 w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
              <Command.List
                className="max-h-60 overflow-y-auto p-1"
                ref={(node) => {
                  if (!node) return;
                  // Fix: Radix's RemoveScroll blocks wheel events on portalled
                  // Popover content. Handle scrolling manually.
                  node.addEventListener(
                    'wheel',
                    (e) => {
                      const { scrollTop, scrollHeight, clientHeight } = node;
                      const atTop = scrollTop === 0 && e.deltaY < 0;
                      const atBottom =
                        scrollTop + clientHeight >= scrollHeight && e.deltaY > 0;
                      if (!atTop && !atBottom) {
                        e.preventDefault();
                        node.scrollTop += e.deltaY;
                      }
                    },
                    { passive: false },
                  );
                }}
              >
                {isSearching ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">Searching...</div>
                ) : displayOptions.length === 0 ? (
                  <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
                    {onSearch && !search ? 'Type to search...' : 'No results found.'}
                  </Command.Empty>
                ) : (
                  displayOptions.map((opt) => (
                    <Command.Item
                      key={opt.value}
                      value={opt.value}
                      disabled={opt.disabled}
                      onSelect={() => handleSelect(opt)}
                      className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          value === opt.value ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      {opt.label}
                    </Command.Item>
                  ))
                )}
              </Command.List>
            </Command>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    );
  },
);
Combobox.displayName = 'Combobox';

export type { ComboboxOption } from '../../hooks/useComboboxState';
