import type { ColumnDef } from '@tanstack/react-table';
import type { FieldDefinition } from '@packages/eav-attributes-ui';

type Row = Record<string, unknown>;

/** Format a field value for display in a table cell. */
function formatCellValue(field: FieldDefinition, value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';

  switch (field.fieldType) {
    case 'boolean':
      return value ? 'Yes' : 'No';

    case 'currency': {
      const num = Number(value);
      return isNaN(num) ? String(value) : `$${(num / 100).toFixed(2)}`;
    }

    case 'picklist': {
      const opt = field.picklistOptions?.find((o) => o.value === value);
      return opt?.label ?? String(value);
    }

    case 'multi_select': {
      const vals = Array.isArray(value) ? value : [];
      return vals
        .map((v) => field.picklistOptions?.find((o) => o.value === v)?.label ?? v)
        .join(', ') || '-';
    }

    case 'date':
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
        return new Date(value).toLocaleDateString();
      }
      return String(value);

    case 'datetime':
      if (typeof value === 'string' || value instanceof Date) {
        return new Date(value as string).toLocaleString();
      }
      return String(value);

    default:
      return String(value);
  }
}

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
 * - Auto_number and readonly fields are excluded
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
    // Skip auto-generated, large text, and file fields from table display
    if (f.fieldType === 'auto_number') return false;
    if (f.fieldType === 'textarea') return false;
    if (f.fieldType === 'file') return false;
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
    // Only standard DB columns can sort server-side
    enableSorting: !!field.columnName,
    cell: ({ row }) => {
      // For lookup/category fields, display the resolved __label if available
      if (field.fieldType === 'lookup' || field.fieldType === 'user' || field.fieldType === 'category') {
        const label = row.original[`${field.fieldKey}__label`];
        if (label != null && label !== '') return String(label);
      }
      // For tags fields, show tag names as comma-separated list
      if (field.fieldType === 'tags') {
        const tags = row.original[field.fieldKey];
        if (Array.isArray(tags) && tags.length > 0) {
          return tags.map((t: { name: string }) => t.name).join(', ');
        }
        return '-';
      }
      // For multi_user/multi_lookup fields, show labels as comma-separated list
      if (field.fieldType === 'multi_user' || field.fieldType === 'multi_lookup') {
        const items = row.original[field.fieldKey];
        if (Array.isArray(items) && items.length > 0) {
          return items.map((i: { label: string }) => i.label).join(', ');
        }
        return '-';
      }
      const value = row.original[field.fieldKey];
      return formatCellValue(field, value);
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
    .filter((f) => (f.fieldType === 'lookup' || f.fieldType === 'user') && f.lookupEntity)
    .map((f) => ({
      fieldKey: f.fieldKey,
      label: f.label,
      lookupEntity: f.lookupEntity!,
    }));
}
