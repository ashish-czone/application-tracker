import * as React from 'react';
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import { Eye, EyeOff, Check, X, Loader2 } from 'lucide-react';
import { Input } from './Input';
import { Label } from './Label';
import { cn } from '../../lib/utils';

export type AsyncValidationStatus = 'idle' | 'checking' | 'valid' | 'invalid';

interface FormInputProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label: string;
  type?: string;
  placeholder?: string;
  description?: string;
  autoComplete?: string;
  disabled?: boolean;
  className?: string;
  /** Async validation status — shows inline icon (spinner, check, cross) */
  asyncStatus?: AsyncValidationStatus;
  /** Error message for async validation (shown when asyncStatus is 'invalid') */
  asyncError?: string;
  /** Called on blur with the current value — use for async validation like uniqueness checks */
  onBlurValidate?: (value: string) => void;
}

export function FormInput<T extends FieldValues>({
  control,
  name,
  label,
  type = 'text',
  placeholder,
  description,
  autoComplete,
  disabled,
  className,
  asyncStatus,
  asyncError,
  onBlurValidate,
}: FormInputProps<T>) {
  const [showPassword, setShowPassword] = React.useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;
  const errorId = `${name}-error`;
  const descriptionId = `${name}-description`;
  const hasAsyncIcon = asyncStatus && asyncStatus !== 'idle';
  const needsRightPadding = isPassword || hasAsyncIcon;

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
                type={inputType}
                placeholder={placeholder}
                autoComplete={autoComplete}
                disabled={disabled}
                aria-invalid={hasError || showAsyncError || undefined}
                aria-describedby={describedBy}
                className={cn(needsRightPadding && 'pr-10')}
                onBlur={(e) => {
                  field.onBlur();
                  if (onBlurValidate && e.target.value) {
                    onBlurValidate(e.target.value);
                  }
                }}
              />
              {/* Password toggle */}
              {isPassword && (
                <button
                  type="button"
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              )}
              {/* Async validation icon */}
              {!isPassword && hasAsyncIcon && (
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
