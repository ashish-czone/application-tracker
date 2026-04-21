import { fieldTypeRegistry } from '@packages/field-types';
import type { FieldDefinition, EntityRelationship } from '../types';

export interface SplitResult {
  /** Fields with columnName (stored in entity table) — keys are fieldKey (camelCase = Drizzle property name) */
  standardFields: Record<string, unknown>;
  /** Fields without columnName (stored in EAV table) — keys are fieldKey */
  customFields: Record<string, unknown>;
  /** Relational fields (tags, file, category) — handled separately by EntityService */
  relationalFields: Record<string, unknown>;
  /**
   * Nested payloads keyed by declared EntityRelationship name. For hasOne this
   * is an object (e.g. `credentials: { password }`); for hasMany / manyToMany
   * it is an array of target IDs or target payloads. The engine forwards each
   * bucket to the relationship's `handler.onCreate / onUpdate` inside the tx.
   */
  relationshipInputs: Record<string, unknown>;
}

/**
 * Split a flat entity payload into standard DB columns, custom EAV fields,
 * field-level relational buckets, and relationship-level inputs.
 *
 * Keys matching a declared EntityRelationship name are routed to
 * `relationshipInputs` so the engine can hand them to the relationship's
 * RelationHandler. Other unknown keys continue to be dropped (already
 * validated upstream).
 *
 * Standard field keys are camelCase Drizzle property names, so the result
 * can be passed directly to Drizzle `.set()` without key transformation.
 */
export function splitPayload(
  definitions: FieldDefinition[],
  payload: Record<string, unknown>,
  relationships: EntityRelationship[] = [],
): SplitResult {
  const defMap = new Map(definitions.map(d => [d.fieldKey, d]));
  const relNames = new Set(relationships.map(r => r.name));
  const standardFields: Record<string, unknown> = {};
  const customFields: Record<string, unknown> = {};
  const relationalFields: Record<string, unknown> = {};
  const relationshipInputs: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (relNames.has(key)) {
      relationshipInputs[key] = value;
      continue;
    }

    const def = defMap.get(key);
    if (!def) continue; // unknown keys are ignored (already validated)

    if (fieldTypeRegistry.isRelational(def.fieldType)) {
      relationalFields[key] = value;
    } else if (def.columnName !== null) {
      standardFields[key] = value;
    } else {
      customFields[key] = value;
    }
  }

  return { standardFields, customFields, relationalFields, relationshipInputs };
}
