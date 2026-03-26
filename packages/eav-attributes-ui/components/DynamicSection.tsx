import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDown, ChevronRight, Pencil } from 'lucide-react';
import { Form } from '@packages/ui/components/form/Form';
import { DynamicField } from './DynamicField';
import { buildFormSchema } from '../helpers/buildFormSchema';
import type { LayoutSection } from '../types';

interface DynamicSectionProps {
  section: LayoutSection;
  values: Record<string, unknown>;
  onSave: (values: Record<string, unknown>) => Promise<void>;
  isSaving?: boolean;
  /** Lookup options keyed by field key (for user/lookup fields in edit mode) */
  fieldLookupOptions?: Record<string, { label: string; value: string }[]>;
  /** Chip options keyed by field key (for multi_user fields in edit mode) */
  fieldChipOptions?: Record<string, { label: string; value: string; color?: string }[]>;
  /** Async search for single-select fields (lookup, user). Returns a search function for a given field key. */
  getFieldSearch?: (fieldKey: string, fieldType: string) => ((query: string) => Promise<{ label: string; value: string }[]>) | undefined;
  /** Async search for multi-select fields (multi_user, multi_lookup). Returns a search function for a given field key. */
  getChipSearch?: (fieldKey: string, fieldType: string) => ((query: string) => Promise<{ label: string; value: string; color?: string }[]>) | undefined;
}

/**
 * Renders a layout section with its fields.
 * Supports collapsible header, edit/save/cancel toggle, and grid layout.
 */
export function DynamicSection({ section, values, onSave, isSaving, fieldLookupOptions, fieldChipOptions, getFieldSearch, getChipSearch }: DynamicSectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const editableFields = useMemo(
    () => section.fields.filter(f => f.fieldType !== 'auto_number'),
    [section.fields],
  );

  const schema = useMemo(() => buildFormSchema(editableFields), [editableFields]);

  // Build default values from current entity values
  const defaultValues = useMemo(() => {
    const defaults: Record<string, unknown> = {};
    for (const field of editableFields) {
      const val = values[field.fieldKey];
      defaults[field.fieldKey] = val ?? (field.defaultValue ?? '');
    }
    return defaults;
  }, [editableFields, values]);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const handleSave = async (formValues: Record<string, unknown>) => {
    // Only send fields that changed
    const changed: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(formValues)) {
      // Coerce empty strings to null for optional fields
      const coerced = val === '' ? null : val;
      if (coerced !== values[key]) {
        changed[key] = coerced;
      }
    }

    if (Object.keys(changed).length > 0) {
      await onSave(changed);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    form.reset(defaultValues);
    setIsEditing(false);
  };

  const handleEdit = () => {
    form.reset(defaultValues);
    setIsEditing(true);
  };

  const isTwoColumn = section.columns >= 2;

  // Split fields by column assignment
  const col0Fields = useMemo(
    () => section.fields.filter(f => f.columnIndex !== 1),
    [section.fields],
  );
  const col1Fields = useMemo(
    () => section.fields.filter(f => f.columnIndex === 1),
    [section.fields],
  );
  const col0Editable = useMemo(
    () => editableFields.filter(f => f.columnIndex !== 1),
    [editableFields],
  );
  const col1Editable = useMemo(
    () => editableFields.filter(f => f.columnIndex === 1),
    [editableFields],
  );

  const renderViewColumn = (fields: typeof section.fields) =>
    fields.map(field => (
      <DynamicField
        key={field.fieldKey}
        field={field}
        mode="view"
        value={values[field.fieldKey]}
        resolvedLabel={values[`${field.fieldKey}__label`] as string | undefined}
      />
    ));

  const renderEditColumn = (fields: typeof editableFields) =>
    fields.map(field => (
      <DynamicField
        key={field.fieldKey}
        field={field}
        mode="edit"
        lookupOptions={fieldLookupOptions?.[field.fieldKey]}
        chipOptions={fieldChipOptions?.[field.fieldKey]}
        onSearch={getFieldSearch?.(field.fieldKey, field.fieldType)}
        onChipSearch={getChipSearch?.(field.fieldKey, field.fieldType)}
      />
    ));

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Section header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <button
          type="button"
          onClick={() => section.isCollapsible && setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-2 text-sm font-semibold text-foreground"
          disabled={!section.isCollapsible}
        >
          {section.isCollapsible && (
            isCollapsed
              ? <ChevronRight className="h-4 w-4" />
              : <ChevronDown className="h-4 w-4" />
          )}
          {section.name}
        </button>
        {!isEditing && !isCollapsed && (
          <button
            type="button"
            onClick={handleEdit}
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Section body */}
      {!isCollapsed && (
        <div className="p-4">
          {isEditing ? (
            <Form form={form} onSubmit={form.handleSubmit(handleSave)}>
              {isTwoColumn ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-4">{renderEditColumn(col0Editable)}</div>
                  <div className="space-y-4">{renderEditColumn(col1Editable)}</div>
                </div>
              ) : (
                <div className="space-y-4">{renderEditColumn(editableFields)}</div>
              )}
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </Form>
          ) : (
            isTwoColumn ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-4">{renderViewColumn(col0Fields)}</div>
                <div className="space-y-4">{renderViewColumn(col1Fields)}</div>
              </div>
            ) : (
              <div className="space-y-4">{renderViewColumn(section.fields)}</div>
            )
          )}
        </div>
      )}
    </div>
  );
}
