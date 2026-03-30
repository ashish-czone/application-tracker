import type { FieldDefinition } from '../types';
import { RELATIONAL_FIELD_TYPES } from '../types';

export interface SplitResult {
  /** Fields with columnName (stored in entity table) — keys are fieldKey (camelCase = Drizzle property name) */
  standardFields: Record<string, unknown>;
  /** Fields without columnName (stored in EAV table) — keys are fieldKey */
  customFields: Record<string, unknown>;
  /** Relational fields (tags, file, category) — handled separately by EntityService */
  relationalFields: Record<string, unknown>;
}

/**
 * Split a flat entity payload into standard DB columns, custom EAV fields, and relational fields.
 * Uses `definition.columnName !== null` to distinguish standard vs custom.
 * Relational field types (tags, file, category) are extracted into a separate bucket.
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
  const relationalFields: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload)) {
    const def = defMap.get(key);
    if (!def) continue; // unknown keys are ignored (already validated)

    if (RELATIONAL_FIELD_TYPES.has(def.fieldType)) {
      relationalFields[key] = value;
    } else if (def.columnName !== null) {
      standardFields[key] = value;
    } else {
      customFields[key] = value;
    }
  }

  return { standardFields, customFields, relationalFields };
}
