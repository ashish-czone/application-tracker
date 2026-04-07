import { randomUUID } from 'node:crypto';
import { pgTable, text, jsonb, boolean, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';

export const evaluationTemplates = pgTable('evaluation_templates', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  entityType: text('entity_type').notNull(),
  criteria: jsonb('criteria').notNull().$type<{ name: string; description: string }[]>(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex('evaluation_templates_slug_key').on(table.slug),
  index('evaluation_templates_entity_type_idx').on(table.entityType),
]);
