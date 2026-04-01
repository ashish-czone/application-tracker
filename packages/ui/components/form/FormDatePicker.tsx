import { useState } from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import * as Popover from '@radix-ui/react-popover';
import { CalendarIcon } from 'lucide-react';
import { format, parse, isValid } from 'date-fns';
import { Calendar } from './Calendar';
import { Label } from './Label';
import { cn } from '../../lib/utils';

interface FormDatePickerBaseProps {
  label?: string;
  placeholder?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
  /** When true, includes time selection (datetime-local equivalent) */
  includeTime?: boolean;
}

interface FormDatePickerControlledProps extends FormDatePickerBaseProps {
  name: string;
  value?: never;
  onChange?: never;
}

interface FormDatePickerStandaloneProps extends FormDatePickerBaseProps {
  name?: never;
  value: string;
  onChange: (value: string) => void;
}

export type FormDatePickerProps = FormDatePickerControlledProps | FormDatePickerStandaloneProps;

/** Format for display */
function formatDisplayDate(dateStr: string, includeTime?: boolean): string {
  if (!dateStr) return '';
  // Handle YYYY-MM-DD
  const dateOnly = parse(dateStr.substring(0, 10), 'yyyy-MM-dd', new Date());
  if (!isValid(dateOnly)) return dateStr;

  if (includeTime && dateStr.length > 10) {
    // Try to parse time portion
    const timePart = dateStr.substring(11, 16); // HH:mm
    return `${format(dateOnly, 'PPP')} ${timePart}`;
  }
  return format(dateOnly, 'PPP');
}

/** Parse a string value to a Date for the calendar */
function parseToDate(dateStr: string): Date | undefined {
  if (!dateStr) return undefined;
  const d = parse(dateStr.substring(0, 10), 'yyyy-MM-dd', new Date());
  return isValid(d) ? d : undefined;
}

/** Format a Date to YYYY-MM-DD string, optionally preserving existing time */
function dateToString(date: Date, existingValue: string, includeTime?: boolean): string {
  const dateStr = format(date, 'yyyy-MM-dd');
  if (includeTime) {
    const timePart = existingValue.length > 10 ? existingValue.substring(10) : 'T00:00';
    return `${dateStr}${timePart}`;
  }
  return dateStr;
}

export function FormDatePicker(props: FormDatePickerProps) {
  const { label, placeholder = 'Pick a date...', description, disabled, className, includeTime } = props;

  if ('value' in props && props.onChange) {
    return (
      <div className={cn('space-y-2', className)}>
        {label && <Label>{label}</Label>}
        <DatePickerCore
          value={props.value}
          onChange={props.onChange}
          placeholder={placeholder}
          disabled={disabled}
          includeTime={includeTime}
        />
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
    );
  }

  return <FormContextDatePicker {...props as FormDatePickerControlledProps} />;
}

function FormContextDatePicker({
  name,
  label,
  placeholder = 'Pick a date...',
  description,
  disabled,
  className,
  includeTime,
}: FormDatePickerControlledProps) {
  const { control } = useFormContext();
  const errorId = `${name}-error`;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState, formState }) => {
        const hasError = (fieldState.isTouched || formState.isSubmitted) && !!fieldState.error;

        return (
          <div className={cn('space-y-2', className)}>
            {label && <Label htmlFor={name}>{label}</Label>}
            <DatePickerCore
              value={field.value ?? ''}
              onChange={(val) => {
                field.onChange(val);
                field.onBlur();
              }}
              placeholder={placeholder}
              disabled={disabled}
              includeTime={includeTime}
              hasError={hasError}
              id={name}
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

function DatePickerCore({
  value,
  onChange,
  placeholder,
  disabled,
  includeTime,
  hasError,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  includeTime?: boolean;
  hasError?: boolean;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = parseToDate(value);
  const timePart = includeTime && value.length > 10 ? value.substring(11, 16) : '00:00';

  const handleSelect = (date: Date | undefined) => {
    if (!date) {
      onChange('');
      setOpen(false);
      return;
    }
    onChange(dateToString(date, value, includeTime));
    if (!includeTime) setOpen(false);
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!value) return;
    const dateStr = value.substring(0, 10);
    onChange(`${dateStr}T${e.target.value}`);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild disabled={disabled}>
        <button
          type="button"
          id={id}
          aria-invalid={hasError || undefined}
          className={cn(
            'flex h-10 w-full items-center justify-start gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            !value && 'text-muted-foreground',
          )}
        >
          <CalendarIcon className="h-4 w-4 opacity-50" />
          <span className="truncate">
            {value ? formatDisplayDate(value, includeTime) : placeholder}
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="z-50 rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in fade-in-0 zoom-in-95"
          sideOffset={4}
          align="start"
        >
          <Calendar
            mode="single"
            selected={selected}
            onSelect={handleSelect}
            defaultMonth={selected}
            autoFocus
          />
          {includeTime && (
            <div className="border-t px-3 py-2 flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Time:</Label>
              <input
                type="time"
                value={timePart}
                onChange={handleTimeChange}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
