import type { FieldType } from '@packages/eav-attributes-ui';

/**
 * Field type compatibility groups for dynamic field mapping.
 * A target field can only be mapped to source fields in the same compatibility group.
 */
const COMPATIBILITY_GROUPS: Record<string, FieldType[]> = {
  text: ['text', 'email', 'phone', 'url', 'textarea', 'rich_text', 'auto_number'],
  number: ['number', 'currency', 'decimal'],
  date: ['date', 'datetime'],
  boolean: ['boolean'],
  picklist: ['picklist', 'workflow'],
  multi_select: ['multi_select'],
  user: ['user'],
  multi_user: ['multi_user'],
  lookup: ['lookup'],
  multi_lookup: ['multi_lookup'],
  tags: ['tags'],
  file: ['file'],
  category: ['category'],
};

/** Get the compatibility group key for a field type. */
function getGroupKey(fieldType: FieldType): string {
  for (const [group, types] of Object.entries(COMPATIBILITY_GROUPS)) {
    if (types.includes(fieldType)) return group;
  }
  return 'text'; // fallback
}

/**
 * Check if a source field type is compatible with a target field type.
 * Compatible means the source value can be meaningfully assigned to the target.
 */
export function isFieldTypeCompatible(targetType: FieldType, sourceType: FieldType): boolean {
  return getGroupKey(targetType) === getGroupKey(sourceType);
}

/**
 * Returns true if a stored value is a dynamic (Mustache) template reference.
 */
export function isDynamicValue(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}');
}

/**
 * Extract the field key from a dynamic value template.
 * e.g., "{{payload.after.dueDate}}" → "dueDate"
 */
export function extractDynamicFieldKey(value: string): string | null {
  const match = value.match(/^\{\{payload\.after\.(.+)\}\}$/);
  return match ? match[1] : null;
}

/**
 * Build a dynamic value template from a source field key.
 * e.g., "dueDate" → "{{payload.after.dueDate}}"
 */
export function buildDynamicValue(sourceFieldKey: string): string {
  return `{{payload.after.${sourceFieldKey}}}`;
}
