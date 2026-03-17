import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import { Check, X, Loader2 } from 'lucide-react';
import { Input } from './Input';
import { Label } from './Label';
import { cn } from '../../lib/utils';
import type { AsyncValidationStatus } from './FormInput';

interface FormEmailInputProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label: string;
  placeholder?: string;
  description?: string;
  autoComplete?: string;
  disabled?: boolean;
  className?: string;
  /** Async validation status (e.g., from useAsyncValidator) */
  asyncStatus?: AsyncValidationStatus;
  /** Error message when asyncStatus is 'invalid' */
  asyncError?: string;
  /** Called on blur for async validation (e.g., uniqueness check) */
  onBlurValidate?: (value: string) => void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function FormEmailInput<T extends FieldValues>({
  control,
  name,
  label,
  placeholder = 'you@example.com',
  description,
  autoComplete = 'email',
  disabled,
  className,
  asyncStatus,
  asyncError,
  onBlurValidate,
}: FormEmailInputProps<T>) {
  const errorId = `${name}-error`;
  const descriptionId = `${name}-description`;
  const hasAsyncIcon = asyncStatus && asyncStatus !== 'idle';

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState, formState }) => {
        const hasError = (fieldState.isTouched || formState.isSubmitted) && !!fieldState.error;
        const showAsyncError = asyncStatus === 'invalid' && asyncError && !hasError;
        const describedBy = [
          hasError || showAsyncError ? errorId : null,
          description ? descriptionId : null,
        ]
          .filter(Boolean)
          .join(' ') || undefined;

        return (
          <div className={cn('space-y-2', className)}>
            <Label htmlFor={name}>{label}</Label>
            <div className="relative">
              <Input
                {...field}
                id={name}
                type="email"
                placeholder={placeholder}
                autoComplete={autoComplete}
                disabled={disabled}
                aria-invalid={hasError || showAsyncError || undefined}
                aria-describedby={describedBy}
                className={cn(hasAsyncIcon && 'pr-10')}
                onBlur={(e) => {
                  field.onBlur();
                  const value = e.target.value;
                  // Only fire async validation if value is a valid email format
                  if (onBlurValidate && value && EMAIL_REGEX.test(value)) {
                    onBlurValidate(value);
                  }
                }}
              />
              {hasAsyncIcon && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  {asyncStatus === 'checking' && (
                    <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                  )}
                  {asyncStatus === 'valid' && (
                    <Check className="h-4 w-4 text-success" />
                  )}
                  {asyncStatus === 'invalid' && (
                    <X className="h-4 w-4 text-destructive" />
                  )}
                </span>
              )}
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
            {showAsyncError && (
              <p id={errorId} className="text-sm text-destructive" aria-live="polite">
                {asyncError}
              </p>
            )}
          </div>
        );
      }}
    />
  );
}
