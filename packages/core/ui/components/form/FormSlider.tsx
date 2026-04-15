import { useFormContext, Controller } from 'react-hook-form';
import { cn } from '../../lib/utils';
import { Slider } from './Slider';

interface FormSliderProps {
  name: string;
  label?: string;
  description?: string;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
  /** Show tick marks on the track. */
  ticks?: boolean;
  /** Custom legend rendered beneath the track. */
  legend?: React.ReactNode;
  /** Format the live value readout. Defaults to String(value). */
  formatValue?: (value: number) => string;
}

export function FormSlider({
  name,
  label,
  description,
  min = 0,
  max = 100,
  step = 1,
  disabled,
  className,
  ticks,
  legend,
  formatValue = (v) => String(v),
}: FormSliderProps) {
  const { control } = useFormContext();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const value = typeof field.value === 'number' ? field.value : min;
        return (
          <div className={cn('space-y-2', className)}>
            {(label || description) && (
              <div className="flex items-baseline justify-between gap-3">
                {label && (
                  <label
                    htmlFor={name}
                    className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground"
                  >
                    {label}
                  </label>
                )}
                <span
                  data-numeric="true"
                  className="font-mono text-sm tabular-nums"
                >
                  {formatValue(value)}
                </span>
              </div>
            )}
            <Slider
              id={name}
              min={min}
              max={max}
              step={step}
              value={[value]}
              onValueChange={(values) => field.onChange(values[0])}
              disabled={disabled}
              ticks={ticks}
              legend={legend}
            />
            {description && !fieldState.error && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
            {fieldState.error && (
              <p className="text-xs text-destructive">{fieldState.error.message}</p>
            )}
          </div>
        );
      }}
    />
  );
}
