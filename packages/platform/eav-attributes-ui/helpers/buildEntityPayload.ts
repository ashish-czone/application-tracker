import type { FullLayout } from '../types';

/**
 * Reshape flat RHF values into the nested payload shape expected by the entity
 * engine's generic create/update routes. Fields whose `FieldDefinition.nestedPath`
 * is set (hasOne relationships) are collected under that relation name.
 *
 * - Empty strings and `undefined` are dropped.
 * - `null`, `false`, `0`, and empty arrays are preserved.
 * - Keys not present in the layout (e.g. relationship sections like `roles`)
 *   pass through unchanged at the top level.
 * - A nested bucket is only emitted when at least one of its fields has a value.
 */
export function buildEntityPayload(
  values: Record<string, unknown>,
  layout: FullLayout,
): Record<string, unknown> {
  const fieldMap = new Map<string, { nestedPath: string | null | undefined }>();
  for (const section of layout.sections) {
    for (const field of section.fields) {
      fieldMap.set(field.fieldKey, { nestedPath: field.nestedPath });
    }
  }

  const result: Record<string, unknown> = {};
  const nested: Record<string, Record<string, unknown>> = {};

  for (const [key, value] of Object.entries(values)) {
    if (value === '' || value === undefined) continue;
    const field = fieldMap.get(key);
    if (field?.nestedPath) {
      const bucket = (nested[field.nestedPath] ??= {});
      bucket[key] = value;
    } else {
      result[key] = value;
    }
  }

  for (const [path, bucket] of Object.entries(nested)) {
    if (Object.keys(bucket).length > 0) result[path] = bucket;
  }

  return result;
}
