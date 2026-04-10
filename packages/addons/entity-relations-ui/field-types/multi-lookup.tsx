/**
 * UI components for multi_user and multi_lookup field types.
 * These render chip-based multi-select inputs with async search.
 */
import { FormChipInput } from '@packages/ui/components/form/FormChipInput';
import type { FieldRenderProps } from '@packages/field-types/ui';

function fieldLabel(props: FieldRenderProps): string {
  return props.field.isRequired ? `${props.field.label} *` : props.field.label;
}

export function MultiLookupForm(props: FieldRenderProps) {
  return (
    <FormChipInput
      name={props.field.fieldKey}
      label={fieldLabel(props)}
      options={props.onChipSearch ? undefined : props.chipOptions}
      onSearch={props.onChipSearch}
      initialSelected={props.onChipSearch ? props.chipOptions : undefined}
      placeholder={`Search and add ${props.field.label.toLowerCase()}...`}
      disabled={props.field.isReadonly}
    />
  );
}

export function multiLookupView(value: unknown): React.ReactNode {
  const items = Array.isArray(value) ? value : [];
  if (items.length === 0) return <span className="text-sm text-muted-foreground">-</span>;
  return (
    <span className="text-sm text-foreground">
      {items.map((v: { id: string; label: string }) => v.label).join(', ')}
    </span>
  );
}

export function multiLookupCell(value: unknown): string {
  const items = Array.isArray(value) ? value : [];
  if (items.length === 0) return '-';
  return items.map((v: { id: string; label: string }) => v.label).join(', ');
}
