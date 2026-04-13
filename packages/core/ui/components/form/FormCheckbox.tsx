import { useFormContext, Controller } from 'react-hook-form';
import { cn } from '../../lib/utils';
import { Checkbox } from './Checkbox';

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
          <Checkbox
            id={name}
            checked={!!field.value}
            onCheckedChange={(checked) => field.onChange(checked === true)}
            disabled={disabled}
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
