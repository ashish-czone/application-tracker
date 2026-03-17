import { useState, useMemo } from 'react';
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js';
import { Input } from './Input';
import { Label } from './Label';
import { cn } from '../../lib/utils';

interface FormPhoneInputProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label: string;
  placeholder?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
  /** Default country code (ISO 3166-1 alpha-2). Defaults to 'US'. */
  defaultCountry?: CountryCode;
}

const POPULAR_COUNTRIES: CountryCode[] = ['US', 'GB', 'IN', 'AE', 'CA', 'AU'];

interface CountryOption {
  code: CountryCode;
  dialCode: string;
  label: string;
}

function buildCountryOptions(): CountryOption[] {
  const countries = getCountries();
  const popular: CountryOption[] = [];
  const rest: CountryOption[] = [];

  for (const code of countries) {
    const dialCode = `+${getCountryCallingCode(code)}`;
    const option: CountryOption = { code, dialCode, label: `${code} ${dialCode}` };
    if (POPULAR_COUNTRIES.includes(code)) {
      popular.push(option);
    } else {
      rest.push(option);
    }
  }

  // Sort popular by POPULAR_COUNTRIES order, rest alphabetically
  popular.sort((a, b) => POPULAR_COUNTRIES.indexOf(a.code) - POPULAR_COUNTRIES.indexOf(b.code));
  rest.sort((a, b) => a.code.localeCompare(b.code));

  return [...popular, ...rest];
}

export function FormPhoneInput<T extends FieldValues>({
  control,
  name,
  label,
  placeholder = 'Phone number',
  description,
  disabled,
  className,
  defaultCountry = 'US',
}: FormPhoneInputProps<T>) {
  const [country, setCountry] = useState<CountryCode>(defaultCountry);
  const countryOptions = useMemo(() => buildCountryOptions(), []);
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

        // Parse current value to extract local number for display
        const currentValue = String(field.value ?? '');
        const parsed = currentValue ? parsePhoneNumberFromString(currentValue, country) : null;
        const localNumber = parsed?.nationalNumber ?? currentValue.replace(/^\+\d+\s?/, '');

        function handleCountryChange(newCountry: string) {
          const cc = newCountry as CountryCode;
          setCountry(cc);
          // Reformat with new country code if there's a local number
          if (localNumber) {
            const phone = parsePhoneNumberFromString(localNumber, cc);
            field.onChange(phone?.format('E.164') ?? `+${getCountryCallingCode(cc)}${localNumber}`);
          }
        }

        function handleNumberChange(value: string) {
          // Strip non-digit except leading +
          const digits = value.replace(/[^\d]/g, '');
          if (!digits) {
            field.onChange('');
            return;
          }
          const phone = parsePhoneNumberFromString(digits, country);
          field.onChange(phone?.format('E.164') ?? `+${getCountryCallingCode(country)}${digits}`);
        }

        return (
          <div className={cn('space-y-2', className)}>
            <Label htmlFor={name}>{label}</Label>
            <div className="flex gap-2">
              <select
                value={country}
                onChange={(e) => handleCountryChange(e.target.value)}
                disabled={disabled}
                className="h-10 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 w-24 shrink-0"
                aria-label="Country code"
              >
                {countryOptions.map((opt) => (
                  <option key={opt.code} value={opt.code}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <Input
                id={name}
                type="tel"
                value={localNumber}
                onChange={(e) => handleNumberChange(e.target.value)}
                onBlur={field.onBlur}
                placeholder={placeholder}
                disabled={disabled}
                aria-invalid={hasError || undefined}
                aria-describedby={describedBy}
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
