import { fieldTypeUIRegistry } from '@packages/field-types/ui';
import type { FieldRenderProps } from '@packages/field-types/ui';
import type { ChipOption } from '@packages/ui/components/form/FormChipInput';
import type { FieldDefinition } from '../types';

interface DynamicFieldProps {
  field: FieldDefinition;
  mode: 'view' | 'edit';
  value?: unknown;
  /** Resolved display label for lookup/user fields (from __label suffix) */
  resolvedLabel?: string | null;
  /** Pre-fetched lookup options for lookup/user fields (label -> value pairs) */
  lookupOptions?: { label: string; value: string }[];
  /** Pre-fetched options for chip input fields (tags, multi_user, multi_lookup) */
  chipOptions?: ChipOption[];
  /** Async search for lookup/user single-select fields */
  onSearch?: (query: string) => Promise<{ label: string; value: string }[]>;
  /** Async search for multi_user/multi_lookup chip fields */
  onChipSearch?: (query: string) => Promise<ChipOption[]>;
  /**
   * Per-render disabled override. When true, the rendered input is disabled
   * even if `field.isReadonly` is false. Implemented by coercing
   * `isReadonly` to true on the render props — every FormComponent already
   * forwards `isReadonly` to the underlying shadcn input's `disabled`, so
   * no FormComponent changes are needed.
   *
   * The wrapping `title` attribute on the outer element surfaces the
   * tooltip on hover. The input itself is disabled (not just visually),
   * so RHF does not track edits to locked fields.
   */
  disabled?: boolean;
  /** Optional tooltip shown on hover when `disabled` is true. */
  disabledTooltip?: string;
}

/**
 * Renders a single field based on its FieldDefinition.
 * In view mode: displays the formatted value with label.
 * In edit mode: renders the appropriate form component (must be inside a FormProvider).
 */
export function DynamicField({ field, mode, value, resolvedLabel, lookupOptions, chipOptions, onSearch, onChipSearch, disabled, disabledTooltip }: DynamicFieldProps) {
  const uiDef = fieldTypeUIRegistry.get(field.fieldType);

  const effectiveReadonly = field.isReadonly || disabled === true;

  const renderProps: FieldRenderProps = {
    field: {
      fieldKey: field.fieldKey,
      label: field.label,
      fieldType: field.fieldType,
      uiType: field.uiType,
      isRequired: field.isRequired,
      isReadonly: effectiveReadonly,
      maxLength: field.maxLength,
      lookupEntity: field.lookupEntity,
      tagGroupSlug: field.tagGroupSlug,
      categoryGroupSlug: field.categoryGroupSlug,
      fileAccept: field.fileAccept,
      fileMaxSize: field.fileMaxSize,
      picklistOptions: field.picklistOptions?.map(o => ({ label: o.label, value: o.value })),
    },
    resolvedLabel,
    lookupOptions,
    chipOptions,
    onSearch,
    onChipSearch,
  };

  if (mode === 'view') {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">{field.label}</span>
        {uiDef ? uiDef.ViewComponent(value, renderProps) : <span className="text-sm text-foreground">{String(value ?? '-')}</span>}
      </div>
    );
  }

  // Edit mode
  if (!uiDef) {
    return <div className="text-sm text-muted-foreground">Unknown field type: {field.fieldType}</div>;
  }

  const input = <uiDef.FormComponent {...renderProps} />;
  if (disabled && disabledTooltip) {
    return <div title={disabledTooltip}>{input}</div>;
  }
  return input;
}
