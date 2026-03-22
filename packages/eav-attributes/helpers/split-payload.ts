import type { FieldDefinition } from '../types';

export interface SplitResult {
  /** Fields with columnName (stored in entity table) — keys are fieldKey (camelCase = Drizzle property name) */
  standardFields: Record<string, unknown>;
  /** Fields without columnName (stored in EAV table) — keys are fieldKey */
  customFields: Record<string, unknown>;
}

/**
 * Split a flat entity payload into standard DB columns and custom EAV fields.
 * Uses `definition.columnName !== null` to distinguish.
 *
 * Standard field keys are camelCase Drizzle property names, so the result
 * can be passed directly to Drizzle `.set()` without key transformation.
 */
export function splitPayload(
  definitions: FieldDefinition[],
  payload: Record<string, unknown>,
): SplitResult {
  const defMap = new Map(definitions.map(d => [d.fieldKey, d]));
  const standardFields: Record<string, unknown> = {};
  const customFields: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload)) {
    const def = defMap.get(key);
    if (!def) continue; // unknown keys are ignored (already validated)

    if (def.columnName !== null) {
      standardFields[key] = value;
    } else {
      customFields[key] = value;
    }
  }

  return { standardFields, customFields };
}
