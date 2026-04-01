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
  onSearch,
  onChipSearch,
}: FieldValueInputProps) {
  const isDynamic = isDynamicValue(value);

  // Compatible source fields for dynamic mapping
  const compatibleFields = useMemo(() => {
    return sourceFields
      .filter((sf) => isFieldTypeCompatible(field.fieldType, sf.fieldType))
      .map((sf) => ({ value: sf.fieldKey, label: sf.label }));
  }, [sourceFields, field.fieldType]);

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

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{field.label}</span>
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
          field={{ ...field, label: '' }}
          mode="edit"
          lookupOptions={lookupOptions}
          onSearch={onSearch}
          onChipSearch={onChipSearch}
        />
      )}
    </div>
  );
}
