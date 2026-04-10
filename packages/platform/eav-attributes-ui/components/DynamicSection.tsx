import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDown, ChevronRight, Pencil } from 'lucide-react';
import { Form } from '@packages/ui/components/form/Form';
import { DynamicField } from './DynamicField';
import { buildFormSchema } from '../helpers/buildFormSchema';
import type { LayoutSection } from '../types';

export function isFieldEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (value === '') return true;
  if (value === 0) return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

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
  /** When true, show all fields including empty ones */
  showEmptyFields?: boolean;
}

/**
 * Renders a layout section with its fields.
 * Supports collapsible header, edit/save/cancel toggle, and grid layout.
 */
export function DynamicSection({ section, values, onSave, isSaving, fieldLookupOptions, fieldChipOptions, getFieldSearch, getChipSearch, showEmptyFields = false }: DynamicSectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showHidden, setShowHidden] = useState(false);

  const editableFields = useMemo(
    () => section.fields.filter(f => f.fieldType !== 'auto_number'),
    [section.fields],
  );

  const schema = useMemo(() => buildFormSchema(editableFields), [editableFields]);

  // Build default values from current entity values
  const defaultValues = useMemo(() => {
    const defaults: Record<string, unknown> = {};
    for (const field of editableFields) {
      let val = values[field.fieldKey];
      // multi_user/multi_lookup/tags values come hydrated as [{id, ...}] — extract IDs for the form
      if ((field.fieldType === 'multi_user' || field.fieldType === 'multi_lookup' || field.fieldType === 'tags') && Array.isArray(val)) {
        val = val.map((v: any) => typeof v === 'object' && v?.id ? v.id : v);
      }
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

  const shouldHideEmpty = !showEmptyFields && !showHidden && !isEditing;

  const filterFields = (fields: typeof section.fields) => {
    if (!shouldHideEmpty) return { visible: fields, hiddenCount: 0 };
    const visible = fields.filter(f => !isFieldEmpty(values[f.fieldKey]));
    return { visible, hiddenCount: fields.length - visible.length };
  };

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
    fields.map(field => {
      // For multi_user/multi_lookup/tags, derive chip options from hydrated values so existing selections show labels
      let chipOpts = fieldChipOptions?.[field.fieldKey];
      if ((field.fieldType === 'multi_user' || field.fieldType === 'multi_lookup' || field.fieldType === 'tags') && !chipOpts) {
        const rawVal = values[field.fieldKey];
        if (Array.isArray(rawVal) && rawVal.length > 0 && typeof rawVal[0] === 'object' && rawVal[0]?.id) {
          chipOpts = rawVal.map((v: any) => ({ label: v.label ?? v.name ?? v.id, value: v.id, color: v.color }));
        }
      }
      // Pass resolved label for user/lookup fields so FormSelect shows the name on initial render
      const resolvedLabel = values[`${field.fieldKey}__label`] as string | undefined;

      return (
        <DynamicField
          key={field.fieldKey}
          field={field}
          mode="edit"
          resolvedLabel={resolvedLabel}
          lookupOptions={fieldLookupOptions?.[field.fieldKey]}
          chipOptions={chipOpts}
          onSearch={getFieldSearch?.(field.fieldKey, field.fieldType)}
          onChipSearch={getChipSearch?.(field.fieldKey, field.fieldType)}
        />
      );
    });

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
            (() => {
              if (isTwoColumn) {
                const f0 = filterFields(col0Fields);
                const f1 = filterFields(col1Fields);
                const totalHidden = f0.hiddenCount + f1.hiddenCount;
                return (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-4">{renderViewColumn(f0.visible)}</div>
                      <div className="space-y-4">{renderViewColumn(f1.visible)}</div>
                    </div>
                    {totalHidden > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowHidden(true)}
                        className="mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Show {totalHidden} empty {totalHidden === 1 ? 'field' : 'fields'}
                      </button>
                    )}
                  </>
                );
              }
              const { visible, hiddenCount } = filterFields(section.fields);
              return (
                <>
                  <div className="space-y-4">{renderViewColumn(visible)}</div>
                  {hiddenCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowHidden(true)}
                      className="mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Show {hiddenCount} empty {hiddenCount === 1 ? 'field' : 'fields'}
                    </button>
                  )}
                </>
              );
            })()
          )}
        </div>
      )}
    </div>
  );
}
