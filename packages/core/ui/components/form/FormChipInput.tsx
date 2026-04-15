import * as React from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { Label } from './Label';
import { cn } from '../../lib/utils';
import { MultiSelect, type ComboboxOption } from './MultiSelect';

export type ChipOption = ComboboxOption;

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
 * Multi-select chip/tag input with react-hook-form binding.
 *
 * Internally this is a thin wrapper around the standalone `MultiSelect`
 * primitive — which owns the chip rendering, async search, and label
 * cache. Use `MultiSelect` directly if you don't need react-hook-form.
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
        const describedBy =
          [hasError ? errorId : null, description ? descriptionId : null].filter(Boolean).join(' ') ||
          undefined;

        const selectedValues: string[] = Array.isArray(field.value) ? field.value : [];

        return (
          <div className={cn('space-y-2', className)}>
            <Label htmlFor={name}>{label}</Label>
            <MultiSelect
              options={options}
              onSearch={onSearch}
              initialSelected={initialSelected}
              value={selectedValues}
              onChange={(vals) => field.onChange(vals)}
              onBlur={field.onBlur}
              placeholder={placeholder}
              disabled={disabled}
              hasError={hasError}
              id={name}
              aria-describedby={describedBy}
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

// Backwards-compat: the old file also exported a `ChipInput` helper used
// directly by a few call sites. Re-export MultiSelect under that name.
export { MultiSelect as ChipInput } from './MultiSelect';
