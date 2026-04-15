import { useState } from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import * as Popover from '@radix-ui/react-popover';
import { CalendarIcon } from 'lucide-react';
import { format, parse, isValid } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { Calendar } from './Calendar';
import { Label } from './Label';
import { cn } from '../../lib/utils';

export interface DateRangeValue {
  from: string;
  to: string;
}

interface FormDateRangePickerBaseProps {
  label?: string;
  placeholder?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
  /** Number of calendar months to render side-by-side. Defaults to 2. */
  numberOfMonths?: number;
}

interface FormDateRangePickerControlledProps extends FormDateRangePickerBaseProps {
  name: string;
  value?: never;
  onChange?: never;
}

interface FormDateRangePickerStandaloneProps extends FormDateRangePickerBaseProps {
  name?: never;
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
}

export type FormDateRangePickerProps =
  | FormDateRangePickerControlledProps
  | FormDateRangePickerStandaloneProps;

function parseDate(str?: string): Date | undefined {
  if (!str) return undefined;
  const d = parse(str.substring(0, 10), 'yyyy-MM-dd', new Date());
  return isValid(d) ? d : undefined;
}

function dateToString(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

function formatRangeDisplay(value: DateRangeValue): string {
  const from = parseDate(value.from);
  const to = parseDate(value.to);
  if (from && to) return `${format(from, 'MMM d, yyyy')} — ${format(to, 'MMM d, yyyy')}`;
  if (from) return `${format(from, 'MMM d, yyyy')} — …`;
  return '';
}

/**
 * Date range picker — uses react-day-picker in range mode and stores two
 * `YYYY-MM-DD` strings. Pass a `name` for react-hook-form binding, or
 * `value` + `onChange` for standalone use.
 */
export function FormDateRangePicker(props: FormDateRangePickerProps) {
  const { label, placeholder = 'Pick a range…', description, disabled, className, numberOfMonths = 2 } = props;

  if ('value' in props && props.onChange) {
    return (
      <div className={cn('space-y-2', className)}>
        {label && <Label>{label}</Label>}
        <DateRangeCore
          value={props.value}
          onChange={props.onChange}
          placeholder={placeholder}
          disabled={disabled}
          numberOfMonths={numberOfMonths}
        />
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
    );
  }

  return <FormContextDateRangePicker {...(props as FormDateRangePickerControlledProps)} />;
}

function FormContextDateRangePicker({
  name,
  label,
  placeholder = 'Pick a range…',
  description,
  disabled,
  className,
  numberOfMonths,
}: FormDateRangePickerControlledProps) {
  const { control } = useFormContext();
  const errorId = `${name}-error`;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState, formState }) => {
        const hasError = (fieldState.isTouched || formState.isSubmitted) && !!fieldState.error;
        const value: DateRangeValue = field.value ?? { from: '', to: '' };
        return (
          <div className={cn('space-y-2', className)}>
            {label && <Label htmlFor={name}>{label}</Label>}
            <DateRangeCore
              id={name}
              value={value}
              onChange={(next) => {
                field.onChange(next);
                field.onBlur();
              }}
              placeholder={placeholder}
              disabled={disabled}
              hasError={hasError}
              numberOfMonths={numberOfMonths}
            />
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
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

function DateRangeCore({
  value,
  onChange,
  placeholder,
  disabled,
  hasError,
  id,
  numberOfMonths = 2,
}: {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  placeholder?: string;
  disabled?: boolean;
  hasError?: boolean;
  id?: string;
  numberOfMonths?: number;
}) {
  const [open, setOpen] = useState(false);
  const from = parseDate(value.from);
  const to = parseDate(value.to);
  const rangeValue: DateRange | undefined = from ? { from, to } : undefined;

  const handleSelect = (range: DateRange | undefined) => {
    if (!range?.from) {
      onChange({ from: '', to: '' });
      return;
    }
    onChange({
      from: dateToString(range.from),
      to: range.to ? dateToString(range.to) : '',
    });
    if (range.from && range.to) setOpen(false);
  };

  const displayText = formatRangeDisplay(value);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild disabled={disabled}>
        <button
          type="button"
          id={id}
          data-slot="datepicker-trigger"
          aria-invalid={hasError || undefined}
          className={cn(
            'flex h-10 w-full items-center justify-start gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            !displayText && 'text-muted-foreground',
          )}
        >
          <CalendarIcon className="h-4 w-4 opacity-50" />
          <span className="truncate">{displayText || placeholder}</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          data-slot="datepicker-content"
          className="z-50 rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in fade-in-0 zoom-in-95"
          sideOffset={4}
          align="start"
        >
          <Calendar
            mode="range"
            selected={rangeValue}
            onSelect={handleSelect}
            defaultMonth={from}
            numberOfMonths={numberOfMonths}
            autoFocus
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
