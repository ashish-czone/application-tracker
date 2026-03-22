import { FormInput } from '@packages/ui/components/form/FormInput';
import { FormSelect } from '@packages/ui/components/form/FormSelect';
import { FormTextarea } from '@packages/ui/components/form/FormTextarea';
import { FormCheckbox } from '@packages/ui/components/form/FormCheckbox';
import type { FieldDefinition } from '../types';

interface DynamicFieldProps {
  field: FieldDefinition;
  mode: 'view' | 'edit';
  value?: unknown;
}

/** Format a field value for display in view mode */
function formatViewValue(field: FieldDefinition, value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';

  switch (field.fieldType) {
    case 'boolean':
      return value ? 'Yes' : 'No';

    case 'currency': {
      const num = Number(value);
      return isNaN(num) ? String(value) : `$${(num / 100).toFixed(2)}`;
    }

    case 'picklist': {
      const opt = field.picklistOptions?.find(o => o.value === value);
      return opt?.label ?? String(value);
    }

    case 'multi_select': {
      const vals = Array.isArray(value) ? value : [];
      return vals
        .map(v => field.picklistOptions?.find(o => o.value === v)?.label ?? v)
        .join(', ') || '-';
    }

    case 'url':
      return String(value);

    default:
      return String(value);
  }
}

/**
 * Renders a single field based on its FieldDefinition.
 * In view mode: displays the formatted value with label.
 * In edit mode: renders the appropriate form component (must be inside a FormProvider).
 */
export function DynamicField({ field, mode, value }: DynamicFieldProps) {
  if (mode === 'view') {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">{field.label}</span>
        {field.fieldType === 'url' && value && value !== '' ? (
          <a
            href={String(value)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary underline underline-offset-2 truncate"
          >
            {formatViewValue(field, value)}
          </a>
        ) : (
          <span className="text-sm text-foreground">{formatViewValue(field, value)}</span>
        )}
      </div>
    );
  }

  // Edit mode — render appropriate form control
  return <DynamicFieldEdit field={field} />;
}

function DynamicFieldEdit({ field }: { field: FieldDefinition }) {
  const disabled = field.isReadonly;
  const label = field.isRequired ? `${field.label} *` : field.label;

  switch (field.fieldType) {
    case 'text':
      return <FormInput name={field.fieldKey} label={label} disabled={disabled} />;

    case 'email':
      return <FormInput name={field.fieldKey} label={label} type="email" disabled={disabled} />;

    case 'phone':
      return <FormInput name={field.fieldKey} label={label} type="tel" disabled={disabled} />;

    case 'number':
      return <FormInput name={field.fieldKey} label={label} type="number" disabled={disabled} />;

    case 'currency':
      return <FormInput name={field.fieldKey} label={label} type="number" disabled={disabled} description="Value in cents" />;

    case 'decimal':
      return <FormInput name={field.fieldKey} label={label} type="number" disabled={disabled} />;

    case 'date':
      return <FormInput name={field.fieldKey} label={label} type="date" disabled={disabled} />;

    case 'datetime':
      return <FormInput name={field.fieldKey} label={label} type="datetime-local" disabled={disabled} />;

    case 'url':
      return <FormInput name={field.fieldKey} label={label} type="url" disabled={disabled} />;

    case 'textarea':
      return <FormTextarea name={field.fieldKey} label={label} disabled={disabled} />;

    case 'picklist':
      return (
        <FormSelect
          name={field.fieldKey}
          label={label}
          placeholder={`Select ${field.label}`}
          options={field.picklistOptions?.map(o => ({ label: o.label, value: o.value })) ?? []}
          disabled={disabled}
        />
      );

    case 'multi_select':
      // Basic implementation — renders as a picklist for now; proper multi-select can be added later
      return (
        <FormSelect
          name={field.fieldKey}
          label={label}
          placeholder={`Select ${field.label}`}
          options={field.picklistOptions?.map(o => ({ label: o.label, value: o.value })) ?? []}
          disabled={disabled}
        />
      );

    case 'boolean':
      return <FormCheckbox name={field.fieldKey} label={label} disabled={disabled} className="pt-6" />;

    case 'lookup':
    case 'user':
      // Basic text input for now — proper lookup search can be added later
      return <FormInput name={field.fieldKey} label={label} disabled={disabled} placeholder="Enter ID" />;

    case 'auto_number':
      return (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">{field.label}</span>
          <span className="text-sm text-muted-foreground italic">Auto-generated</span>
        </div>
      );

    default:
      return <FormInput name={field.fieldKey} label={label} disabled={disabled} />;
  }
}

