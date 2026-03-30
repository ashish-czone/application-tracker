import { FormInput } from '@packages/ui/components/form/FormInput';
import { FormSelect } from '@packages/ui/components/form/FormSelect';
import { FormTextarea } from '@packages/ui/components/form/FormTextarea';
import { FormCheckbox } from '@packages/ui/components/form/FormCheckbox';
import { FormCurrencyInput } from '@packages/ui/components/form/FormCurrencyInput';
import { FormRichText } from '@packages/ui/components/form/FormRichText';
import { FormChipInput } from '@packages/ui/components/form/FormChipInput';
import { FormFileInput } from '@packages/ui/components/form/FormFileInput';
import type { ChipOption } from '@packages/ui/components/form/FormChipInput';
import type { FieldDefinition } from '../types';

interface DynamicFieldProps {
  field: FieldDefinition;
  mode: 'view' | 'edit';
  value?: unknown;
  /** Resolved display label for lookup/user fields (from __label suffix) */
  resolvedLabel?: string | null;
  /** Pre-fetched lookup options for lookup/user fields (label → value pairs) */
  lookupOptions?: { label: string; value: string }[];
  /** Pre-fetched options for chip input fields (tags, multi_user, multi_lookup) */
  chipOptions?: ChipOption[];
  /** Async search for lookup/user single-select fields */
  onSearch?: (query: string) => Promise<{ label: string; value: string }[]>;
  /** Async search for multi_user/multi_lookup chip fields */
  onChipSearch?: (query: string) => Promise<ChipOption[]>;
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
export function DynamicField({ field, mode, value, resolvedLabel, lookupOptions, chipOptions, onSearch, onChipSearch }: DynamicFieldProps) {
  if (mode === 'view') {
    // Tags: render as colored badges
    if (field.fieldType === 'tags' && Array.isArray(value)) {
      return (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">{field.label}</span>
          <div className="flex flex-wrap gap-1">
            {value.length === 0 && <span className="text-sm text-muted-foreground">-</span>}
            {value.map((tag: { id: string; name: string; color?: string }) => (
              <span
                key={tag.id}
                className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ backgroundColor: tag.color ? `${tag.color}20` : '#e5e7eb', color: tag.color || '#374151' }}
              >
                {tag.name}
              </span>
            ))}
          </div>
        </div>
      );
    }

    // Multi-value fields: render as comma-separated labels
    if ((field.fieldType === 'multi_user' || field.fieldType === 'multi_lookup') && Array.isArray(value)) {
      return (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">{field.label}</span>
          {value.length === 0 ? (
            <span className="text-sm text-muted-foreground">-</span>
          ) : (
            <span className="text-sm text-foreground">
              {value.map((v: { id: string; label: string }) => v.label).join(', ')}
            </span>
          )}
        </div>
      );
    }

    // Rich text: render as HTML
    if (field.fieldType === 'rich_text') {
      return (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">{field.label}</span>
          {value && typeof value === 'string' ? (
            <div className="prose prose-sm max-w-none text-foreground" dangerouslySetInnerHTML={{ __html: value }} />
          ) : (
            <span className="text-sm text-muted-foreground">-</span>
          )}
        </div>
      );
    }

    // File: render as filename with size
    if (field.fieldType === 'file') {
      const file = value as { originalName?: string; size?: number } | null;
      return (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">{field.label}</span>
          {file?.originalName ? (
            <span className="text-sm text-foreground">{file.originalName} {file.size ? `(${(file.size / 1024).toFixed(0)} KB)` : ''}</span>
          ) : (
            <span className="text-sm text-muted-foreground">-</span>
          )}
        </div>
      );
    }

    // For lookup fields, prefer the resolved label over the raw ID
    const displayValue = (field.fieldType === 'lookup' || field.fieldType === 'user' || field.fieldType === 'category') && resolvedLabel
      ? resolvedLabel
      : value;

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
          <span className="text-sm text-foreground">{formatViewValue(field, displayValue)}</span>
        )}
      </div>
    );
  }

  // Edit mode — render appropriate form control
  return <DynamicFieldEdit field={field} resolvedLabel={resolvedLabel} lookupOptions={lookupOptions} chipOptions={chipOptions} onSearch={onSearch} onChipSearch={onChipSearch} />;
}

function DynamicFieldEdit({ field, resolvedLabel, lookupOptions, chipOptions, onSearch, onChipSearch }: { field: FieldDefinition; resolvedLabel?: string | null; lookupOptions?: { label: string; value: string }[]; chipOptions?: ChipOption[]; onSearch?: (query: string) => Promise<{ label: string; value: string }[]>; onChipSearch?: (query: string) => Promise<ChipOption[]> }) {
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
      return <FormCurrencyInput name={field.fieldKey} label={label} disabled={disabled} />;

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

    case 'rich_text':
      return <FormRichText name={field.fieldKey} label={label} disabled={disabled} maxLength={field.maxLength ?? undefined} />;

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
      return (
        <FormSelect
          name={field.fieldKey}
          label={label}
          placeholder={`Select ${field.label}`}
          options={lookupOptions}
          onSearch={onSearch}
          disabled={disabled}
          initialDisplayValue={resolvedLabel ?? undefined}
        />
      );

    case 'auto_number':
      return (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">{field.label}</span>
          <span className="text-sm text-muted-foreground italic">Auto-generated</span>
        </div>
      );

    case 'tags':
      return (
        <FormChipInput
          name={field.fieldKey}
          label={label}
          options={onChipSearch ? undefined : (chipOptions ?? [])}
          onSearch={onChipSearch}
          initialSelected={onChipSearch ? chipOptions : undefined}
          placeholder={`Search and add ${field.label.toLowerCase()}...`}
          disabled={disabled}
        />
      );

    case 'file':
      return (
        <FormFileInput
          name={field.fieldKey}
          label={label}
          accept={field.fileAccept ?? undefined}
          maxFileSize={field.fileMaxSize ?? undefined}
          disabled={disabled}
        />
      );

    case 'multi_user':
    case 'multi_lookup':
      return (
        <FormChipInput
          name={field.fieldKey}
          label={label}
          options={onChipSearch ? undefined : chipOptions}
          onSearch={onChipSearch}
          initialSelected={onChipSearch ? chipOptions : undefined}
          placeholder={`Search and add ${field.label.toLowerCase()}...`}
          disabled={disabled}
        />
      );

    case 'category':
      return (
        <FormSelect
          name={field.fieldKey}
          label={label}
          placeholder={`Select ${field.label}`}
          options={lookupOptions}
          onSearch={onSearch}
          disabled={disabled}
          initialDisplayValue={resolvedLabel ?? undefined}
        />
      );

    default:
      return <FormInput name={field.fieldKey} label={label} disabled={disabled} />;
  }
}

