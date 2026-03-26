import { useState, useRef, useEffect, useCallback } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import { useFormContext, Controller } from 'react-hook-form';
import * as Popover from '@radix-ui/react-popover';
import { Command } from 'cmdk';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Label } from './Label';
import { cn } from '../../lib/utils';

interface SelectOption {
  label: string;
  value: string;
}

interface FormSelectBaseProps {
  label?: string;
  /** Static options — filtered client-side */
  options?: SelectOption[];
  /** Async search callback — called on keystroke with debounce. Used when options is not provided. */
  onSearch?: (query: string) => Promise<SelectOption[]>;
  placeholder?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
  /** Initial display value for async fields (e.g., resolved label from backend) */
  initialDisplayValue?: string;
}

interface FormSelectControlledProps extends FormSelectBaseProps {
  name: string;
  value?: never;
  onChange?: never;
}

interface FormSelectStandaloneProps extends FormSelectBaseProps {
  name?: never;
  value: string;
  onChange: (value: string) => void;
}

export type FormSelectProps = FormSelectControlledProps | FormSelectStandaloneProps;

export function FormSelect(props: FormSelectProps) {
  const { label, options, onSearch, placeholder = 'Select...', description, disabled, className } = props;

  // Standalone mode: value + onChange provided, no form context needed
  if ('value' in props && props.onChange) {
    const selectedOption = options?.find((o) => o.value === props.value);

    return (
      <div className={cn('space-y-2', className)}>
        {label && <Label>{label}</Label>}
        <SearchableSelect
          options={options}
          onSearch={onSearch}
          value={props.value}
          onChange={props.onChange}
          placeholder={placeholder}
          disabled={disabled}
          displayValue={selectedOption?.label}
        />
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
    );
  }

  // Form mode: uses react-hook-form context
  return <FormContextSelect {...props as FormSelectControlledProps} />;
}

function FormContextSelect({
  name,
  label,
  options,
  onSearch,
  placeholder = 'Select...',
  description,
  disabled,
  className,
  initialDisplayValue,
}: FormSelectControlledProps) {
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

        const selectedOption = options?.find((o) => o.value === field.value);

        return (
          <div className={cn('space-y-2', className)}>
            {label && <Label htmlFor={name}>{label}</Label>}
            <SearchableSelect
              options={options}
              onSearch={onSearch}
              value={field.value ?? ''}
              onChange={(val) => {
                field.onChange(val);
                field.onBlur();
              }}
              placeholder={placeholder}
              disabled={disabled}
              hasError={hasError}
              describedBy={describedBy}
              id={name}
              displayValue={selectedOption?.label ?? initialDisplayValue}
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

function SearchableSelect({
  options,
  onSearch,
  value,
  onChange,
  placeholder,
  disabled,
  hasError,
  describedBy,
  id,
  displayValue,
}: {
  options?: SelectOption[];
  onSearch?: (query: string) => Promise<SelectOption[]>;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  hasError?: boolean;
  describedBy?: string;
  id?: string;
  displayValue?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [asyncResults, setAsyncResults] = useState<SelectOption[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [cachedLabel, setCachedLabel] = useState<string | undefined>(displayValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedSearch = useDebounce(search, 300);

  // Keep cached label in sync with external displayValue
  useEffect(() => {
    if (displayValue) setCachedLabel(displayValue);
  }, [displayValue]);

  useEffect(() => {
    if (open) {
      setSearch('');
      setAsyncResults([]);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Async search effect
  useEffect(() => {
    if (!onSearch || !open) return;
    if (!debouncedSearch && !open) return;

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
  }, [debouncedSearch, onSearch, open]);

  // Determine which options to display
  const displayOptions = options
    ? options.filter((opt) => !search || opt.label.toLowerCase().includes(search.toLowerCase()))
    : asyncResults;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild disabled={disabled}>
        <button
          type="button"
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-invalid={hasError || undefined}
          aria-describedby={describedBy}
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            !value && 'text-muted-foreground',
          )}
        >
          <span className="truncate">{cachedLabel ?? displayValue ?? placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
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
                placeholder="Search..."
                className="flex h-9 w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <Command.List className="max-h-60 overflow-y-auto p-1">
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
                    onSelect={() => {
                      const newVal = opt.value === value ? '' : opt.value;
                      onChange(newVal);
                      setCachedLabel(newVal ? opt.label : undefined);
                      setOpen(false);
                    }}
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
}
