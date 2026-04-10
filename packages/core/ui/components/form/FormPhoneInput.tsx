import { useFormContext, Controller } from 'react-hook-form';
import PhoneInput from 'react-phone-number-input';
import type { CountryCode } from 'libphonenumber-js';
import { Label } from './Label';
import { cn } from '../../lib/utils';
import 'react-phone-number-input/style.css';

interface FormPhoneInputProps {
  name: string;
  label: string;
  placeholder?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
  /** Default country code (ISO 3166-1 alpha-2). Defaults to 'US'. */
  defaultCountry?: CountryCode;
  /** Show the country code dropdown. Defaults to true. */
  showCountrySelect?: boolean;
}

export function FormPhoneInput({
  name,
  label,
  placeholder = 'Phone number',
  description,
  disabled,
  className,
  defaultCountry = 'US',
  showCountrySelect = true,
}: FormPhoneInputProps) {
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

        return (
          <div className={cn('space-y-2', className)}>
            <Label htmlFor={name}>{label}</Label>
            <PhoneInput
              international
              countryCallingCodeEditable={false}
              defaultCountry={defaultCountry}
              value={field.value || ''}
              onChange={(value) => field.onChange(value ?? '')}
              onBlur={field.onBlur}
              placeholder={placeholder}
              disabled={disabled}
              countrySelectProps={showCountrySelect ? undefined : { style: { display: 'none' } }}
              className={cn(
                'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
                'focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-50',
                hasError && 'border-destructive',
                '[&_.PhoneInputInput]:bg-transparent [&_.PhoneInputInput]:outline-none [&_.PhoneInputInput]:flex-1 [&_.PhoneInputInput]:text-sm',
                '[&_.PhoneInputCountry]:mr-2',
              )}
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
