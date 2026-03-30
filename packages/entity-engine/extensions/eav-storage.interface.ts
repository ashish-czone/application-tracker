/**
 * Interface for EAV value storage operations.
 * Implemented by @packages/eav-attributes when loaded.
 * When not loaded, entity-engine works on schema columns only.
 */
export interface EavStorageExtension {
  // --- EAV field values ---

  /** Get all custom field values for a single entity. */
  getValues(entityType: string, entityId: string, tx?: any): Promise<Record<string, unknown>>;

  /** Batch get custom field values for multiple entities (for list hydration). */
  getBatchValues(entityType: string, entityIds: string[]): Promise<Map<string, Record<string, unknown>>>;

  /** Set/upsert custom field values. Returns before/after snapshots. */
  setValues(entityType: string, entityId: string, values: Record<string, unknown>, tx?: any): Promise<{ before: Record<string, unknown>; after: Record<string, unknown> }>;

  /** Build SQL filter conditions for EAV fields. */
  buildFilterCondition(entityType: string, entityIdColumn: any, filters: { fieldKey: string; operator: any; value: any }[]): any;

  /** Check if a value is unique across all entities for a given field. */
  checkUniqueness(entityType: string, fieldKey: string, value: unknown, excludeEntityId?: string): Promise<boolean>;

  // --- Multi-value fields (multi_user, multi_lookup) ---

  /** Set multi-value targets for a field (replaces all). */
  setMultiValues(entityType: string, entityId: string, fieldKey: string, targetIds: string[]): Promise<void>;

  /** Get all multi-value fields for an entity. Returns { fieldKey: targetId[] }. */
  getAllMultiValues(entityType: string, entityId: string): Promise<Record<string, string[]>>;
}

/** NestJS injection token for the EAV storage extension. */
export const EAV_STORAGE_EXTENSION = 'EAV_STORAGE_EXTENSION';
