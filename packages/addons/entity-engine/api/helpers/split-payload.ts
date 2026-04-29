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
   * Nested payloads keyed by declared EntityRelationship name. The engine
   * does not consume this bucket — it exists to keep relationship keys out
   * of `standardFields` / `customFields`, so an entity that ships a nested
   * relationship payload (e.g. credentials, roles) doesn't trip validation.
   * Modules that need those payloads parse them in their own service layer.
   */
  relationshipInputs: Record<string, unknown>;
}

/**
 * Split a flat entity payload into standard DB columns, custom EAV fields,
 * field-level relational buckets, and relationship-level inputs.
 *
 * Keys matching a declared EntityRelationship name are routed to
 * `relationshipInputs` and otherwise dropped from the engine write path —
 * the owning module's hand-written service is responsible for handling them.
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
