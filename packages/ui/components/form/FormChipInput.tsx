import * as React from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { X } from 'lucide-react';
import { Label } from './Label';
import { cn } from '../../lib/utils';
import { useDebounce } from '../../hooks/useDebounce';

export interface ChipOption {
  label: string;
  value: string;
  color?: string;
}

interface FormChipInputProps {
  name: string;
  label: string;
  /** Static options — filtered client-side. When set, async search is NOT used. */
  options?: ChipOption[];
  /** Async search callback — called on keystroke with debounce. Used when options is not provided. */
  onSearch?: (query: string) => Promise<ChipOption[]>;
  /** Pre-resolved labels for already-selected values (seeds the label cache without blocking async search) */
  initialSelected?: ChipOption[];
  placeholder?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Multi-select chip/tag input component.
 * Selected items display as removable chips. Type to filter available options.
 * Stores value as string[] (array of option values).
 *
 * Used for: tags, multi_user, multi_lookup fields.
 */
export function FormChipInput({
  name,
  label,
  options,
  onSearch,
  initialSelected,
  placeholder = 'Search and add...',
  description,
  disabled,
  className,
}: FormChipInputProps) {
  const { control } = useFormContext();
  const errorId = `${name}-error`;
  const descriptionId = `${name}-description`;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState, formState }) => {
        const hasError = (fieldState.isTouched || formState.isSubmitted) && !!fieldState.error;
        const describedBy = [
          hasError ? errorId : null,
          description ? descriptionId : null,
        ]
          .filter(Boolean)
          .join(' ') || undefined;

        const selectedValues: string[] = Array.isArray(field.value) ? field.value : [];

        return (
          <div className={cn('space-y-2', className)}>
            <Label htmlFor={name}>{label}</Label>
            <ChipInputInner
              options={options}
              onSearch={onSearch}
              initialSelected={initialSelected}
              selectedValues={selectedValues}
              onChange={(vals) => field.onChange(vals)}
              onBlur={field.onBlur}
              placeholder={placeholder}
              disabled={disabled}
              hasError={hasError}
              aria-describedby={describedBy}
              inputId={name}
            />
            {description && (
              <p id={descriptionId} className="text-sm text-muted-foreground">
                {description}
              </p>
            )}
            {hasError && (
              <p id={errorId} className="text-sm text-destructive" aria-live="polite">
                {fieldState.error?.message}
              </p>
            )}
          </div>
        );
      }}
    />
  );
}

function ChipInputInner({
  options,
  onSearch,
  initialSelected,
  selectedValues,
  onChange,
  onBlur,
  placeholder,
  disabled,
  hasError,
  inputId,
  ...rest
}: {
  options?: ChipOption[];
  onSearch?: (query: string) => Promise<ChipOption[]>;
  initialSelected?: ChipOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  onBlur: () => void;
  placeholder?: string;
  disabled?: boolean;
  hasError?: boolean;
  inputId: string;
  'aria-describedby'?: string;
}) {
  const [search, setSearch] = React.useState('');
  const [isOpen, setIsOpen] = React.useState(false);
  const [asyncResults, setAsyncResults] = React.useState<ChipOption[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [selectedCache, setSelectedCache] = React.useState<Map<string, ChipOption>>(() => {
    const map = new Map<string, ChipOption>();
    if (initialSelected) {
      for (const opt of initialSelected) map.set(opt.value, opt);
    }
    return map;
  });

  // Sync initialSelected prop changes into cache (e.g., draft restore)
  React.useEffect(() => {
    if (!initialSelected?.length) return;
    setSelectedCache(prev => {
      const next = new Map(prev);
      for (const opt of initialSelected) next.set(opt.value, opt);
      return next;
    });
  }, [initialSelected]);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const debouncedSearch = useDebounce(search, 300);

  const selectedSet = new Set(selectedValues);
  const optionMap = new Map([...(options ?? []), ...asyncResults, ...selectedCache.values()].map(o => [o.value, o]));

  // Async search effect
  React.useEffect(() => {
    if (!onSearch || !isOpen) return;
    if (!debouncedSearch) { setAsyncResults([]); return; }

    let cancelled = false;
    setIsSearching(true);
    onSearch(debouncedSearch).then((results) => {
      if (!cancelled) {
        setAsyncResults(results);
        setIsSearching(false);
      }
    }).catch(() => {
      if (!cancelled) setIsSearching(false);
    });

    return () => { cancelled = true; };
  }, [debouncedSearch, onSearch, isOpen]);

  // Determine which options to display
  const filteredOptions = options
    ? options.filter(
        (o) => !selectedSet.has(o.value) && o.label.toLowerCase().includes(search.toLowerCase()),
      )
    : asyncResults.filter((o) => !selectedSet.has(o.value));

  const addValue = (value: string) => {
    // Cache the selected option so its label persists after async results clear
    const opt = optionMap.get(value);
    if (opt) {
      setSelectedCache(prev => new Map(prev).set(value, opt));
    }
    onChange([...selectedValues, value]);
    setSearch('');
    inputRef.current?.focus();
  };

  const removeValue = (value: string) => {
    onChange(selectedValues.filter(v => v !== value));
  };

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={containerRef} className="relative" {...rest}>
      <div
        className={cn(
          'flex flex-wrap items-center gap-1 min-h-[40px] w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm ring-offset-background',
          'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
          hasError && 'border-destructive',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
        onClick={() => !disabled && inputRef.current?.focus()}
      >
        {/* Selected chips */}
        {selectedValues.map((val) => {
          const opt = optionMap.get(val);
          return (
            <span
              key={val}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
              style={{
                backgroundColor: opt?.color ? `${opt.color}20` : 'hsl(var(--accent))',
                color: opt?.color || 'hsl(var(--accent-foreground))',
              }}
            >
              {opt?.label ?? val}
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeValue(val); }}
                  className="ml-0.5 rounded-full hover:bg-black/10 p-0.5"
                  aria-label={`Remove ${opt?.label ?? val}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          );
        })}

        {/* Search input */}
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => { setTimeout(() => setIsOpen(false), 150); onBlur(); }}
          placeholder={selectedValues.length === 0 ? placeholder : ''}
          disabled={disabled}
          className="flex-1 min-w-[80px] bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          autoComplete="off"
        />
      </div>

      {/* Dropdown */}
      {isOpen && filteredOptions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-input bg-popover shadow-md max-h-48 overflow-y-auto">
          {filteredOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => addValue(opt.value)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              {opt.color && (
                <span
                  className="inline-block w-2 h-2 rounded-full mr-2"
                  style={{ backgroundColor: opt.color }}
                />
              )}
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {isOpen && isSearching && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-input bg-popover shadow-md">
          <p className="px-3 py-2 text-sm text-muted-foreground">Searching...</p>
        </div>
      )}

      {isOpen && !isSearching && filteredOptions.length === 0 && search && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-input bg-popover shadow-md">
          <p className="px-3 py-2 text-sm text-muted-foreground">No results found</p>
        </div>
      )}

      {isOpen && !isSearching && filteredOptions.length === 0 && !search && onSearch && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-input bg-popover shadow-md">
          <p className="px-3 py-2 text-sm text-muted-foreground">Type to search...</p>
        </div>
      )}
    </div>
  );
}
