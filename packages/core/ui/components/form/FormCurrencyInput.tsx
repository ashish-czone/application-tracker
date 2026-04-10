import * as React from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { Input } from './Input';
import { Label } from './Label';
import { cn } from '../../lib/utils';

interface FormCurrencyInputProps {
  name: string;
  label: string;
  /** Currency symbol displayed as prefix (default: $) */
  currencySymbol?: string;
  placeholder?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Currency input with symbol prefix and number formatting.
 * Stores value as cents (integer) internally, displays as formatted dollars.
 */
export function FormCurrencyInput({
  name,
  label,
  currencySymbol = '$',
  placeholder = '0.00',
  description,
  disabled,
  className,
}: FormCurrencyInputProps) {
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

        // Convert cents to display value
        const displayValue = field.value != null && field.value !== ''
          ? (Number(field.value) / 100).toFixed(2)
          : '';

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
          const raw = e.target.value.replace(/[^0-9.]/g, '');
          if (raw === '' || raw === '.') {
            field.onChange('');
            return;
          }
          // Convert dollars to cents
          const dollars = parseFloat(raw);
          if (!isNaN(dollars)) {
            field.onChange(Math.round(dollars * 100));
          }
        };

        return (
          <div className={cn('space-y-2', className)}>
            <Label htmlFor={name}>{label}</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                {currencySymbol}
              </span>
              <Input
                id={name}
                type="text"
                inputMode="decimal"
                value={displayValue}
                onChange={handleChange}
                onBlur={field.onBlur}
                placeholder={placeholder}
                disabled={disabled}
                aria-invalid={hasError || undefined}
                aria-describedby={describedBy}
                className="pl-7"
              />
            </div>
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
