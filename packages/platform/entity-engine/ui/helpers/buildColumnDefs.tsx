import type { ColumnDef } from '@tanstack/react-table';
import { fieldTypeRegistry } from '@packages/field-types';
import { fieldTypeUIRegistry } from '@packages/field-types/ui';
import type { FieldDefinition } from '@packages/eav-attributes-ui';

type Row = Record<string, unknown>;

interface BuildColumnDefsOptions {
  /** Maximum number of columns to generate (default 8) */
  maxColumns?: number;
  /** Field keys to exclude from columns */
  excludeFields?: string[];
  /** Field keys to always include (even if over maxColumns) */
  includeFields?: string[];
}

/**
 * Generates DataGrid ColumnDef[] from field definitions.
 *
 * - Each field becomes a column with the correct cell formatting
 * - Sorting is enabled only for fields with columnName (standard DB columns)
 * - System fields (id, createdBy, etc.) are excluded
 * - Fields with excludeFromList=true are excluded
 */
export function buildColumnDefs(
  fields: FieldDefinition[],
  options: BuildColumnDefsOptions = {},
): ColumnDef<Row, unknown>[] {
  const {
    maxColumns = 8,
    excludeFields = [],
    includeFields = [],
  } = options;

  const excludeSet = new Set(excludeFields);
  const includeSet = new Set(includeFields);

  // Filter fields suitable for table display
  const displayFields = fields.filter((f) => {
    if (excludeSet.has(f.fieldKey)) return false;
    if (includeSet.has(f.fieldKey)) return true;
    // Use registry to check if type should be excluded from lists
    const ft = fieldTypeRegistry.get(f.fieldType);
    if (ft?.excludeFromList) return false;
    // Skip system fields
    if (f.isSystem && !f.isQuickCreate) return false;
    return true;
  });

  // Take first N fields (respecting maxColumns)
  const columnsToShow = displayFields.slice(0, maxColumns);

  return columnsToShow.map((field): ColumnDef<Row, unknown> => ({
    id: field.fieldKey,
    header: field.label,
    accessorKey: field.fieldKey,
    enableSorting: !!field.columnName,
    cell: ({ row }) => {
      const uiDef = fieldTypeUIRegistry.get(field.fieldType);
      if (uiDef) {
        return uiDef.CellFormatter(
          row.original[field.fieldKey],
          row.original,
          {
            field: {
              fieldKey: field.fieldKey,
              label: field.label,
              fieldType: field.fieldType,
              isRequired: field.isRequired,
              isReadonly: field.isReadonly,
              maxLength: field.maxLength,
              lookupEntity: field.lookupEntity,
              tagGroupSlug: field.tagGroupSlug,
              categoryGroupSlug: field.categoryGroupSlug,
              fileAccept: field.fileAccept,
              fileMaxSize: field.fileMaxSize,
              picklistOptions: field.picklistOptions?.map(o => ({ label: o.label, value: o.value })),
            },
          },
        );
      }
      const value = row.original[field.fieldKey];
      return value != null ? String(value) : '-';
    },
  }));
}

/**
 * Generates DataGrid filter configs from picklist fields.
 * Each picklist field becomes a filter dropdown.
 */
export function buildFilterConfigs(fields: FieldDefinition[]) {
  return fields
    .filter((f) => f.fieldType === 'picklist' && f.picklistOptions && f.picklistOptions.length > 0)
    .map((f) => ({
      key: f.fieldKey,
      label: f.label,
      options: f.picklistOptions!.map((o) => ({ label: o.label, value: o.value })),
    }));
}

/** Metadata for a lookup field that needs async option fetching. */
export interface LookupFilterField {
  fieldKey: string;
  label: string;
  lookupEntity: string;
}

/**
 * Extracts lookup fields that can be used as filters.
 * Options must be fetched asynchronously via the /lookups endpoint.
 */
export function buildLookupFilterFields(fields: FieldDefinition[]): LookupFilterField[] {
  return fields
    .filter((f) => {
      const ft = fieldTypeRegistry.get(f.fieldType);
      return ft?.isReference && !ft?.isArray && f.lookupEntity;
    })
    .map((f) => ({
      fieldKey: f.fieldKey,
      label: f.label,
      lookupEntity: f.lookupEntity!,
    }));
}
