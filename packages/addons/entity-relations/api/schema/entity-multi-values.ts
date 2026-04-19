import { pgTable, text, timestamp, integer, primaryKey, index } from 'drizzle-orm/pg-core';

/**
 * Generic junction table for multi-value relational fields (multi_user, multi_lookup).
 *
 * Stores multiple target references per entity field. Similar pattern to entity_tags
 * but for arbitrary entity/user references defined as field types.
 *
 * Example: Job Opening "Assigned Recruiters" → multiple user IDs
 *   entity_type: 'job_openings', entity_id: '<jo-id>',
 *   field_key: 'assignedRecruiters', target_id: '<user-id-1>'
 */
export const entityMultiValues = pgTable('entity_multi_values', {
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  fieldKey: text('field_key').notNull(),
  targetId: text('target_id').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.entityType, table.entityId, table.fieldKey, table.targetId] }),
  index('emv_entity_lookup_idx').on(table.entityType, table.entityId, table.fieldKey),
  index('emv_target_lookup_idx').on(table.targetId),
]);
