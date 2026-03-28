import { pgTable, text, boolean, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';
import { sql } from 'drizzle-orm';

export const workflowDefinitions = pgTable('workflow_definitions', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  entityType: text('entity_type').notNull(),
  fieldName: text('field_name').notNull(),
  initialState: text('initial_state').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  /** Discriminator key matching the entity config's discriminator.key (e.g., 'client-country') */
  discriminatorKey: text('discriminator_key'),
  /** Discriminator value this pipeline handles (e.g., 'UK'). Null for the default pipeline. */
  discriminatorValue: text('discriminator_value'),
  /** Whether this is the default pipeline when no discriminator matches */
  isDefault: boolean('is_default').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
}, (table) => [
  uniqueIndex('workflow_definitions_slug_key')
    .on(table.slug)
    .where(sql`${table.deletedAt} IS NULL`),
  index('workflow_definitions_entity_type_field_name_idx')
    .on(table.entityType, table.fieldName),
  index('workflow_definitions_entity_type_idx').on(table.entityType),
]);
