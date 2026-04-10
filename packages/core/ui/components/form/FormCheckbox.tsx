import { useFormContext, Controller } from 'react-hook-form';
import { cn } from '../../lib/utils';

interface FormCheckboxProps {
  name: string;
  label: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}

export function FormCheckbox({
  name,
  label,
  description,
  disabled,
  className,
}: FormCheckboxProps) {
  const { control } = useFormContext();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className={cn('flex items-center gap-2', className)}>
          <input
            type="checkbox"
            id={name}
            checked={!!field.value}
            onChange={(e) => field.onChange(e.target.checked)}
            disabled={disabled}
            className="h-4 w-4 rounded border-input"
          />
          <label htmlFor={name} className="text-sm cursor-pointer select-none">
            {label}
          </label>
          {description && (
            <span className="text-xs text-muted-foreground">{description}</span>
          )}
        </div>
      )}
    />
  );
}
