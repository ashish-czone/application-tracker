import { useState, useMemo } from 'react';
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  AsYouType,
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
  /** Show the country code dropdown. Defaults to true. When false, user types full international number. */
  showCountrySelect?: boolean;
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

  popular.sort((a, b) => POPULAR_COUNTRIES.indexOf(a.code) - POPULAR_COUNTRIES.indexOf(b.code));
  rest.sort((a, b) => a.code.localeCompare(b.code));

  return [...popular, ...rest];
}

/** Format a national number as-you-type for a given country */
function formatNational(digits: string, country: CountryCode): string {
  if (!digits) return '';
  const dialCode = `+${getCountryCallingCode(country)}`;
  const formatter = new AsYouType(country);
  const formatted = formatter.input(`${dialCode}${digits}`);
  // Strip the country code prefix from the formatted result to show only national portion
  return formatted.replace(new RegExp(`^\\+${getCountryCallingCode(country)}\\s?`), '');
}

/** Format a full international number as-you-type (no country context) */
function formatInternational(value: string): string {
  if (!value) return '';
  const formatter = new AsYouType();
  return formatter.input(value.startsWith('+') ? value : `+${value}`);
}

export function FormPhoneInput<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  description,
  disabled,
  className,
  defaultCountry = 'US',
  showCountrySelect = true,
}: FormPhoneInputProps<T>) {
  const [country, setCountry] = useState<CountryCode>(defaultCountry);
  const countryOptions = useMemo(() => buildCountryOptions(), []);
  const errorId = `${name}-error`;
  const descriptionId = `${name}-description`;

  const defaultPlaceholder = showCountrySelect ? 'Phone number' : '+1 555 123 4567';

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

        const currentValue = String(field.value ?? '');

        if (showCountrySelect) {
          // With country dropdown: show formatted national number
          const parsed = currentValue ? parsePhoneNumberFromString(currentValue, country) : null;
          const rawDigits = parsed?.nationalNumber ?? currentValue.replace(/^\+\d+\s?/, '').replace(/\D/g, '');
          const displayValue = formatNational(rawDigits, country);

          function handleCountryChange(newCountry: string) {
            const cc = newCountry as CountryCode;
            setCountry(cc);
            if (rawDigits) {
              const phone = parsePhoneNumberFromString(rawDigits, cc);
              field.onChange(phone?.format('E.164') ?? `+${getCountryCallingCode(cc)}${rawDigits}`);
            }
          }

          function handleNumberChange(value: string) {
            const digits = value.replace(/\D/g, '');
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
                  value={displayValue}
                  onChange={(e) => handleNumberChange(e.target.value)}
                  onBlur={field.onBlur}
                  placeholder={placeholder ?? defaultPlaceholder}
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
        }

        // Without country dropdown: show formatted international number
        const displayValue = formatInternational(currentValue);

        function handleFullNumberChange(value: string) {
          // Keep + and digits only for storage
          const cleaned = value.replace(/[^\d+]/g, '');
          if (!cleaned || cleaned === '+') {
            field.onChange('');
            return;
          }
          // Ensure leading +
          const withPlus = cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
          const phone = parsePhoneNumberFromString(withPlus);
          field.onChange(phone?.format('E.164') ?? withPlus);
        }

        return (
          <div className={cn('space-y-2', className)}>
            <Label htmlFor={name}>{label}</Label>
            <Input
              id={name}
              type="tel"
              value={displayValue}
              onChange={(e) => handleFullNumberChange(e.target.value)}
              onBlur={field.onBlur}
              placeholder={placeholder ?? defaultPlaceholder}
              disabled={disabled}
              aria-invalid={hasError || undefined}
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
