/**
 * Interface for multi-value relational field operations (multi_user, multi_lookup).
 * Implemented by @packages/entity-relations when loaded.
 * When not loaded, multi-value field types are unavailable.
 */
export interface MultiValueExtension {
  /** Set multi-value targets for a field (replaces all). Accepts optional tx to join caller's transaction. */
  setMultiValues(entityType: string, entityId: string, fieldKey: string, targetIds: string[], tx?: any): Promise<void>;

  /** Get all multi-value fields for an entity. Returns { fieldKey: targetId[] }. */
  getAllMultiValues(entityType: string, entityId: string): Promise<Record<string, string[]>>;
}

/** NestJS injection token for the multi-value extension. */
export const MULTI_VALUE_EXTENSION = 'MULTI_VALUE_EXTENSION';
