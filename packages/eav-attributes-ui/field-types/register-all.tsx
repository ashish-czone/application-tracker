/**
 * Register UI definitions for all 23 field types.
 * Import this file at app startup to populate the UI registry.
 */
import { fieldTypeUIRegistry, zodSchemas } from '@packages/field-types/ui';
import type { FieldTypeUIDefinition, FieldRenderProps } from '@packages/field-types/ui';
import { formatLabel, formatDate, formatDateTime, formatCurrency } from '@packages/common';
import { FormInput } from '@packages/ui/components/form/FormInput';
import { FormSelect } from '@packages/ui/components/form/FormSelect';
import { FormTextarea } from '@packages/ui/components/form/FormTextarea';
import { FormCheckbox } from '@packages/ui/components/form/FormCheckbox';
import { FormCurrencyInput } from '@packages/ui/components/form/FormCurrencyInput';
import { FormRichText } from '@packages/ui/components/form/FormRichText';
import { FormChipInput } from '@packages/ui/components/form/FormChipInput';
import { FormFileInput } from '@packages/ui/components/form/FormFileInput';
import { FormDatePicker } from '@packages/ui/components/form/FormDatePicker';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function viewLabel(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
}

function defaultView(value: unknown): React.ReactNode {
  return <span className="text-sm text-foreground">{viewLabel(value)}</span>;
}

function defaultCell(value: unknown): string {
  return viewLabel(value);
}

function fieldLabel(props: FieldRenderProps): string {
  return props.field.isRequired ? `${props.field.label} *` : props.field.label;
}

// ---------------------------------------------------------------------------
// Text family
// ---------------------------------------------------------------------------

function TextForm(props: FieldRenderProps) {
  return <FormInput name={props.field.fieldKey} label={fieldLabel(props)} disabled={props.field.isReadonly} />;
}

function EmailForm(props: FieldRenderProps) {
  return <FormInput name={props.field.fieldKey} label={fieldLabel(props)} type="email" disabled={props.field.isReadonly} />;
}

function PhoneForm(props: FieldRenderProps) {
  return <FormInput name={props.field.fieldKey} label={fieldLabel(props)} type="tel" disabled={props.field.isReadonly} />;
}

function UrlForm(props: FieldRenderProps) {
  return <FormInput name={props.field.fieldKey} label={fieldLabel(props)} type="url" disabled={props.field.isReadonly} />;
}

function UrlView(value: unknown, props: FieldRenderProps): React.ReactNode {
  if (!value || value === '') return <span className="text-sm text-muted-foreground">-</span>;
  return (
    <a href={String(value)} target="_blank" rel="noopener noreferrer"
      className="text-sm text-primary underline underline-offset-2 truncate">
      {String(value)}
    </a>
  );
}

function TextareaForm(props: FieldRenderProps) {
  return <FormTextarea name={props.field.fieldKey} label={fieldLabel(props)} disabled={props.field.isReadonly} />;
}

function RichTextForm(props: FieldRenderProps) {
  return <FormRichText name={props.field.fieldKey} label={fieldLabel(props)} disabled={props.field.isReadonly} maxLength={props.field.maxLength ?? undefined} />;
}

function RichTextView(value: unknown): React.ReactNode {
  if (value && typeof value === 'string') {
    return <div className="prose prose-sm max-w-none text-foreground" dangerouslySetInnerHTML={{ __html: value }} />;
  }
  return <span className="text-sm text-muted-foreground">-</span>;
}

// ---------------------------------------------------------------------------
// Numeric family
// ---------------------------------------------------------------------------

function NumberForm(props: FieldRenderProps) {
  return <FormInput name={props.field.fieldKey} label={fieldLabel(props)} type="number" disabled={props.field.isReadonly} />;
}

function CurrencyForm(props: FieldRenderProps) {
  return <FormCurrencyInput name={props.field.fieldKey} label={fieldLabel(props)} disabled={props.field.isReadonly} />;
}

function currencyView(value: unknown): React.ReactNode {
  const display = formatCurrency(value != null ? Number(value) : null);
  return <span className={`text-sm ${display === '—' ? 'text-muted-foreground' : 'text-foreground'}`}>{display}</span>;
}

function currencyCell(value: unknown): string {
  return formatCurrency(value != null ? Number(value) : null);
}

// ---------------------------------------------------------------------------
// Date family
// ---------------------------------------------------------------------------

function DateForm(props: FieldRenderProps) {
  return <FormDatePicker name={props.field.fieldKey} label={fieldLabel(props)} disabled={props.field.isReadonly} />;
}

function DatetimeForm(props: FieldRenderProps) {
  return <FormDatePicker name={props.field.fieldKey} label={fieldLabel(props)} disabled={props.field.isReadonly} includeTime />;
}

function dateView(value: unknown): React.ReactNode {
  if (!value) return <span className="text-sm text-muted-foreground">-</span>;
  return <span className="text-sm text-foreground">{formatDate(String(value))}</span>;
}

function dateCell(value: unknown): string {
  if (!value) return '-';
  return formatDate(String(value));
}

function datetimeView(value: unknown): React.ReactNode {
  if (!value) return <span className="text-sm text-muted-foreground">-</span>;
  return <span className="text-sm text-foreground">{formatDateTime(String(value))}</span>;
}

function datetimeCell(value: unknown): string {
  if (!value) return '-';
  return formatDateTime(String(value));
}

// ---------------------------------------------------------------------------
// Boolean
// ---------------------------------------------------------------------------

function BooleanForm(props: FieldRenderProps) {
  return <FormCheckbox name={props.field.fieldKey} label={fieldLabel(props)} disabled={props.field.isReadonly} className="pt-6" />;
}

function booleanView(value: unknown): React.ReactNode {
  return <span className="text-sm text-foreground">{value ? 'Yes' : 'No'}</span>;
}

function booleanCell(value: unknown): string {
  return value ? 'Yes' : 'No';
}

// ---------------------------------------------------------------------------
// Selection family (picklist, multi_select)
// ---------------------------------------------------------------------------

function PicklistForm(props: FieldRenderProps) {
  return (
    <FormSelect
      name={props.field.fieldKey}
      label={fieldLabel(props)}
      placeholder={`Select ${props.field.label}`}
      options={props.field.picklistOptions?.map(o => ({ label: o.label, value: o.value })) ?? []}
      disabled={props.field.isReadonly}
    />
  );
}

function picklistView(value: unknown, props: FieldRenderProps): React.ReactNode {
  if (!value) return <span className="text-sm text-muted-foreground">-</span>;
  const opt = props.field.picklistOptions?.find(o => o.value === value);
  return <span className="text-sm text-foreground">{opt?.label ?? String(value)}</span>;
}

function picklistCell(value: unknown, row: Record<string, unknown>, props: FieldRenderProps): string {
  if (!value) return '-';
  const opt = props.field.picklistOptions?.find(o => o.value === value);
  return opt?.label ?? String(value);
}

function multiSelectView(value: unknown, props: FieldRenderProps): React.ReactNode {
  const vals = Array.isArray(value) ? value : [];
  if (vals.length === 0) return <span className="text-sm text-muted-foreground">-</span>;
  return (
    <span className="text-sm text-foreground">
      {vals.map(v => props.field.picklistOptions?.find(o => o.value === v)?.label ?? v).join(', ')}
    </span>
  );
}

function multiSelectCell(value: unknown, _row: Record<string, unknown>, props: FieldRenderProps): string {
  const vals = Array.isArray(value) ? value : [];
  if (vals.length === 0) return '-';
  return vals.map(v => props.field.picklistOptions?.find(o => o.value === v)?.label ?? v).join(', ');
}

// ---------------------------------------------------------------------------
// Reference family (lookup, multi_lookup, user, multi_user)
// ---------------------------------------------------------------------------

function LookupForm(props: FieldRenderProps) {
  return (
    <FormSelect
      name={props.field.fieldKey}
      label={fieldLabel(props)}
      placeholder={`Select ${props.field.label}`}
      options={props.lookupOptions}
      onSearch={props.onSearch}
      disabled={props.field.isReadonly}
      initialDisplayValue={props.resolvedLabel ?? undefined}
    />
  );
}

function lookupView(value: unknown, props: FieldRenderProps): React.ReactNode {
  const display = props.resolvedLabel ?? (value ? String(value) : null);
  return <span className="text-sm text-foreground">{display ?? '-'}</span>;
}

function lookupCell(value: unknown, row: Record<string, unknown>, props: FieldRenderProps): string {
  const label = row[`${props.field.fieldKey}__label`];
  return label != null ? String(label) : (value ? String(value) : '-');
}

// multi_lookup and multi_user UI components are in @packages/entity-relations-ui

// ---------------------------------------------------------------------------
// Taxonomy family (tags, category)
// ---------------------------------------------------------------------------

function TagsForm(props: FieldRenderProps) {
  return (
    <FormChipInput
      name={props.field.fieldKey}
      label={fieldLabel(props)}
      options={props.onChipSearch ? undefined : (props.chipOptions ?? [])}
      onSearch={props.onChipSearch}
      initialSelected={props.onChipSearch ? props.chipOptions : undefined}
      placeholder={`Search and add ${props.field.label.toLowerCase()}...`}
      disabled={props.field.isReadonly}
    />
  );
}

function tagsView(value: unknown): React.ReactNode {
  const tags = Array.isArray(value) ? value : [];
  if (tags.length === 0) return <span className="text-sm text-muted-foreground">-</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag: { id: string; name: string; color?: string }) => (
        <span
          key={tag.id}
          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
          style={{ backgroundColor: tag.color ? `${tag.color}20` : '#e5e7eb', color: tag.color || '#374151' }}
        >
          {tag.name}
        </span>
      ))}
    </div>
  );
}

function tagsCell(value: unknown): string {
  const tags = Array.isArray(value) ? value : [];
  return tags.map((t: { name: string }) => t.name).join(', ') || '-';
}

// Category reuses LookupForm and lookupView (single UUID)

// ---------------------------------------------------------------------------
// Special types
// ---------------------------------------------------------------------------

function AutoNumberForm(props: FieldRenderProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{props.field.label}</span>
      <span className="text-sm text-muted-foreground italic">Auto-generated</span>
    </div>
  );
}

function FileForm(props: FieldRenderProps) {
  return (
    <FormFileInput
      name={props.field.fieldKey}
      label={fieldLabel(props)}
      accept={props.field.fileAccept ?? undefined}
      maxFileSize={props.field.fileMaxSize ?? undefined}
      disabled={props.field.isReadonly}
    />
  );
}

function fileView(value: unknown): React.ReactNode {
  const file = value as { originalName?: string; size?: number } | null;
  if (!file?.originalName) return <span className="text-sm text-muted-foreground">-</span>;
  return (
    <span className="text-sm text-foreground">
      {file.originalName} {file.size ? `(${(file.size / 1024).toFixed(0)} KB)` : ''}
    </span>
  );
}

function WorkflowForm(props: FieldRenderProps) {
  // Workflow fields are read-only — state changes go through transition endpoint
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{props.field.label}</span>
      <span className="text-sm text-muted-foreground italic">Managed by workflow</span>
    </div>
  );
}

function workflowView(value: unknown): React.ReactNode {
  if (!value || typeof value !== 'string') return <span className="text-sm text-muted-foreground">-</span>;
  return <span className="text-sm text-foreground">{formatLabel(value)}</span>;
}

function workflowCell(value: unknown): string {
  if (!value || typeof value !== 'string') return '-';
  return formatLabel(value);
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

const definitions: FieldTypeUIDefinition[] = [
  // Text family
  { type: 'text',      FormComponent: TextForm,     ViewComponent: defaultView,     CellFormatter: defaultCell,      zodSchema: zodSchemas.stringSchema },
  { type: 'email',     FormComponent: EmailForm,    ViewComponent: defaultView,     CellFormatter: defaultCell,      zodSchema: zodSchemas.emailSchema },
  { type: 'phone',     FormComponent: PhoneForm,    ViewComponent: defaultView,     CellFormatter: defaultCell,      zodSchema: zodSchemas.stringSchema },
  { type: 'url',       FormComponent: UrlForm,      ViewComponent: UrlView,         CellFormatter: defaultCell,      zodSchema: zodSchemas.urlSchema },
  { type: 'textarea',  FormComponent: TextareaForm, ViewComponent: defaultView,     CellFormatter: defaultCell,      zodSchema: zodSchemas.stringSchema },
  { type: 'rich_text', FormComponent: RichTextForm, ViewComponent: RichTextView,    CellFormatter: defaultCell,      zodSchema: zodSchemas.stringSchema },

  // Numeric family
  { type: 'number',    FormComponent: NumberForm,   ViewComponent: defaultView,     CellFormatter: defaultCell,      zodSchema: zodSchemas.integerSchema },
  { type: 'currency',  FormComponent: CurrencyForm, ViewComponent: currencyView,    CellFormatter: currencyCell,     zodSchema: zodSchemas.integerSchema },
  { type: 'decimal',   FormComponent: NumberForm,   ViewComponent: defaultView,     CellFormatter: defaultCell,      zodSchema: zodSchemas.decimalSchema },

  // Date family
  { type: 'date',      FormComponent: DateForm,     ViewComponent: dateView,        CellFormatter: dateCell,         zodSchema: zodSchemas.dateSchema },
  { type: 'datetime',  FormComponent: DatetimeForm, ViewComponent: datetimeView,    CellFormatter: datetimeCell,     zodSchema: zodSchemas.datetimeSchema },

  // Boolean
  { type: 'boolean',   FormComponent: BooleanForm,  ViewComponent: booleanView,     CellFormatter: booleanCell,      zodSchema: zodSchemas.booleanSchema },

  // Selection family
  { type: 'picklist',     FormComponent: PicklistForm,     ViewComponent: picklistView,     CellFormatter: picklistCell,     zodSchema: zodSchemas.uuidSchema },
  { type: 'multi_select', FormComponent: PicklistForm,     ViewComponent: multiSelectView,  CellFormatter: multiSelectCell,  zodSchema: zodSchemas.arraySchema },

  // Reference family (multi_lookup + multi_user are registered by @packages/entity-relations-ui)
  { type: 'lookup',       FormComponent: LookupForm,       ViewComponent: lookupView,       CellFormatter: lookupCell,       zodSchema: zodSchemas.uuidSchema },
  { type: 'user',         FormComponent: LookupForm,       ViewComponent: lookupView,       CellFormatter: lookupCell,       zodSchema: zodSchemas.uuidSchema },

  // Taxonomy family
  { type: 'tags',         FormComponent: TagsForm,         ViewComponent: tagsView,         CellFormatter: tagsCell,         zodSchema: zodSchemas.arraySchema },
  { type: 'category',     FormComponent: LookupForm,       ViewComponent: lookupView,       CellFormatter: lookupCell,       zodSchema: zodSchemas.uuidSchema },

  // Special types
  { type: 'auto_number',  FormComponent: AutoNumberForm,   ViewComponent: defaultView,      CellFormatter: defaultCell,      zodSchema: zodSchemas.noopSchema },
  { type: 'file',         FormComponent: FileForm,         ViewComponent: fileView,          CellFormatter: defaultCell,      zodSchema: zodSchemas.anySchema },
  { type: 'workflow',     FormComponent: WorkflowForm,     ViewComponent: workflowView,     CellFormatter: workflowCell,     zodSchema: zodSchemas.noopSchema },
];

// Auto-register all UI definitions
fieldTypeUIRegistry.registerAll(definitions);
