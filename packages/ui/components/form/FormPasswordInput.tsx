import { useState } from 'react';
import { useFormContext, Controller, useWatch } from 'react-hook-form';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from './Input';
import { Label } from './Label';
import { PasswordStrength } from './PasswordStrength';
import { cn } from '../../lib/utils';

interface FormPasswordInputProps {
  name: string;
  label: string;
  placeholder?: string;
  description?: string;
  autoComplete?: string;
  disabled?: boolean;
  className?: string;
  /** Show the password strength meter with requirements checklist */
  showStrength?: boolean;
}

export function FormPasswordInput({
  name,
  label,
  placeholder = 'Enter password',
  description,
  autoComplete,
  disabled,
  className,
  showStrength = false,
}: FormPasswordInputProps) {
  const { control } = useFormContext();
  const [showPassword, setShowPassword] = useState(false);
  const passwordValue = useWatch({ control, name });
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
            <div className="relative">
              <Input
                {...field}
                id={name}
                type={showPassword ? 'text' : 'password'}
                placeholder={placeholder}
                autoComplete={autoComplete}
                disabled={disabled}
                aria-invalid={hasError || undefined}
                aria-describedby={describedBy}
                className="pr-10"
              />
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
            </div>
            {showStrength && (
              <PasswordStrength password={String(passwordValue ?? '')} />
            )}
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
