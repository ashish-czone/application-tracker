import { useFormContext, Controller } from 'react-hook-form';
import { Label } from './Label';
import { cn } from '../../lib/utils';
import { Combobox, type ComboboxOption } from './Combobox';

interface SelectOption {
  label: string;
  value: string;
}

interface FormSelectBaseProps {
  label?: string;
  /** Static options — filtered client-side */
  options?: SelectOption[];
  /** Async search callback — called on keystroke with debounce. Used when options is not provided. */
  onSearch?: (query: string) => Promise<SelectOption[]>;
  placeholder?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
  /** Initial display value for async fields (e.g., resolved label from backend) */
  initialDisplayValue?: string;
}

interface FormSelectControlledProps extends FormSelectBaseProps {
  name: string;
  value?: never;
  onChange?: never;
}

interface FormSelectStandaloneProps extends FormSelectBaseProps {
  name?: never;
  value: string;
  onChange: (value: string) => void;
}

export type FormSelectProps = FormSelectControlledProps | FormSelectStandaloneProps;

/**
 * Searchable single-select with optional react-hook-form binding.
 *
 * Internally this is a thin wrapper around the standalone `Combobox`
 * primitive — which owns the cmdk plumbing, debounced async search, and
 * label cache. Use `Combobox` directly if you don't need react-hook-form.
 */
export function FormSelect(props: FormSelectProps) {
  const { label, options, onSearch, placeholder = 'Select...', description, disabled, className } = props;

  // Standalone mode: value + onChange provided, no form context needed
  if ('value' in props && props.onChange) {
    return (
      <div className={cn('space-y-2', className)}>
        {label && <Label>{label}</Label>}
        <Combobox
          options={options as ComboboxOption[] | undefined}
          onSearch={onSearch as ((q: string) => Promise<ComboboxOption[]>) | undefined}
          value={props.value}
          onChange={props.onChange}
          placeholder={placeholder}
          disabled={disabled}
        />
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
    );
  }

  return <FormContextSelect {...(props as FormSelectControlledProps)} />;
}

function FormContextSelect({
  name,
  label,
  options,
  onSearch,
  placeholder = 'Select...',
  description,
  disabled,
  className,
  initialDisplayValue,
}: FormSelectControlledProps) {
  const { control } = useFormContext();
  const errorId = `${name}-error`;
  const descriptionId = `${name}-description`;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState, formState }) => {
        const hasError = (fieldState.isTouched || formState.isSubmitted) && !!fieldState.error;
        const describedBy =
          [hasError ? errorId : null, description ? descriptionId : null].filter(Boolean).join(' ') ||
          undefined;

        return (
          <div className={cn('space-y-2', className)}>
            {label && <Label htmlFor={name}>{label}</Label>}
            <Combobox
              options={options as ComboboxOption[] | undefined}
              onSearch={onSearch as ((q: string) => Promise<ComboboxOption[]>) | undefined}
              value={field.value ?? ''}
              onChange={(val) => {
                field.onChange(val);
                field.onBlur();
              }}
              placeholder={placeholder}
              disabled={disabled}
              hasError={hasError}
              id={name}
              aria-describedby={describedBy}
              initialDisplayValue={initialDisplayValue}
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
