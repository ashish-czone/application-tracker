import { useFormContext, Controller } from 'react-hook-form';
import { Label } from '@packages/ui/components/form/Label';
import { cn } from '@packages/ui/lib/utils';
import { StarRating } from './StarRating';

interface FormRatingInputProps {
  name: string;
  label: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}

export function FormRatingInput({
  name,
  label,
  description,
  disabled,
  className,
}: FormRatingInputProps) {
  const { control } = useFormContext();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState, formState }) => {
        const hasError =
          (fieldState.isTouched || formState.isSubmitted) && !!fieldState.error;

        return (
          <div className={cn('space-y-2', className)}>
            <Label htmlFor={name}>{label}</Label>
            <StarRating
              value={field.value}
              onChange={disabled ? undefined : field.onChange}
            />
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
            {hasError && (
              <p className="text-sm text-destructive" aria-live="polite">
                {fieldState.error?.message}
              </p>
            )}
          </div>
        );
      }}
    />
  );
}
