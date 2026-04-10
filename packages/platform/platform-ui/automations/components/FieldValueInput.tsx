import { useMemo } from 'react';
import { Zap, Type } from 'lucide-react';
import { FormSelect } from '@packages/ui';
import { DynamicField, type FieldDefinition } from '@packages/eav-attributes-ui';
import { isFieldTypeCompatible, isDynamicValue, extractDynamicFieldKey, buildDynamicValue } from './field-compatibility';

interface FieldValueInputProps {
  /** The target field being set */
  field: FieldDefinition;
  /** Current value — either a static value or a dynamic template like {{payload.after.x}} */
  value: unknown;
  /** Called when the value changes (either static form change or dynamic field selection) */
  onDynamicChange: (fieldKey: string, value: unknown) => void;
  /** Fields from the triggering entity (source) for dynamic mapping */
  sourceFields: FieldDefinition[];
  /** Props to pass through to DynamicField for static mode */
  lookupOptions?: { label: string; value: string }[];
  /** Resolved display label for lookup/user fields (from pre-fetched options) */
  resolvedLabel?: string | null;
  onSearch?: (query: string) => Promise<{ label: string; value: string }[]>;
  onChipSearch?: (query: string) => Promise<{ label: string; value: string; color?: string }[]>;
}

/**
 * Wraps a field with a static/dynamic toggle.
 * - Static mode: renders DynamicField (the normal form input)
 * - Dynamic mode: renders a dropdown of type-compatible source fields
 *
 * Dynamic values are stored as Mustache templates: {{payload.after.fieldKey}}
 */
export function FieldValueInput({
  field,
  value,
  onDynamicChange,
  sourceFields,
  lookupOptions,
  resolvedLabel,
  onSearch,
  onChipSearch,
}: FieldValueInputProps) {
  const isDynamic = isDynamicValue(value);

  // Field types that should never offer dynamic mapping
  const noDynamicTypes = ['workflow', 'file', 'rich_text'];
  const allowDynamic = !noDynamicTypes.includes(field.fieldType);

  // Compatible source fields for dynamic mapping
  const compatibleFields = useMemo(() => {
    if (!allowDynamic) return [];
    return sourceFields
      .filter((sf) => isFieldTypeCompatible(field.fieldType, sf.fieldType))
      .map((sf) => ({ value: sf.fieldKey, label: sf.label }));
  }, [sourceFields, field.fieldType, allowDynamic]);

  const selectedSourceKey = isDynamic ? extractDynamicFieldKey(value as string) : null;
  const hasDynamicOptions = compatibleFields.length > 0;

  const toggleMode = () => {
    if (isDynamic) {
      // Switch to static — clear the dynamic value
      onDynamicChange(field.fieldKey, '');
    } else {
      // Switch to dynamic — pick first compatible field
      if (compatibleFields.length > 0) {
        onDynamicChange(field.fieldKey, buildDynamicValue(compatibleFields[0].value));
      }
    }
  };

  const handleDynamicFieldChange = (sourceFieldKey: string) => {
    onDynamicChange(field.fieldKey, buildDynamicValue(sourceFieldKey));
  };

  const label = field.isRequired ? `${field.label} *` : field.label;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="flex-1" />
        {hasDynamicOptions && (
          <button
            type="button"
            onClick={toggleMode}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
              isDynamic
                ? 'bg-primary/10 text-primary hover:bg-primary/20'
                : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-accent'
            }`}
            title={isDynamic ? 'Switch to static value' : 'Use dynamic value from trigger'}
          >
            {isDynamic ? (
              <><Type className="h-3 w-3" /> Static</>
            ) : (
              <><Zap className="h-3 w-3" /> Dynamic</>
            )}
          </button>
        )}
      </div>

      {isDynamic ? (
        <FormSelect
          value={selectedSourceKey ?? ''}
          onChange={handleDynamicFieldChange}
          options={compatibleFields}
          placeholder="Select source field..."
        />
      ) : (
        <DynamicField
          field={{ ...field, label: '', isRequired: false }}
          mode="edit"
          resolvedLabel={resolvedLabel}
          lookupOptions={lookupOptions}
          onSearch={onSearch}
          onChipSearch={onChipSearch}
        />
      )}
    </div>
  );
}
