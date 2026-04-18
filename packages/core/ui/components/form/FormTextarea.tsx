import { useFormContext, Controller } from 'react-hook-form';
import { Label } from './Label';
import { cn } from '../../lib/utils';

interface FormTextareaProps {
  name: string;
  /** Field label. Omit for unlabelled compose-style textareas (a placeholder usually carries the affordance). */
  label?: string;
  placeholder?: string;
  description?: string;
  disabled?: boolean;
  rows?: number;
  className?: string;
  /** Classes applied to the <textarea> element. */
  textareaClassName?: string;
  /** sr-only accessible name when `label` is omitted. Falls back to `placeholder`. */
  ariaLabel?: string;
}

export function FormTextarea({
  name,
  label,
  placeholder,
  description,
  disabled,
  rows = 3,
  className,
  textareaClassName,
  ariaLabel,
}: FormTextareaProps) {
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
          <div className={cn(label ? 'space-y-2' : '', className)}>
            {label && <Label htmlFor={name}>{label}</Label>}
            <textarea
              {...field}
              id={name}
              data-slot="textarea"
              placeholder={placeholder}
              disabled={disabled}
              rows={rows}
              aria-invalid={hasError || undefined}
              aria-describedby={describedBy}
              aria-label={!label ? ariaLabel ?? placeholder : undefined}
              className={cn(
                'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
                'placeholder:text-muted-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'resize-none',
                textareaClassName,
              )}
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
