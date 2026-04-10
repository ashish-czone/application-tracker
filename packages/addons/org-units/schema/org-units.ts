import { pgTable, text, integer, timestamp, index, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';

export const orgUnits = pgTable('org_units', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  name: text('name').notNull(),
  parentId: text('parent_id').references((): AnyPgColumn => orgUnits.id),
  type: text('type').notNull().default('team'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table) => [
  index('org_units_parent_id_idx').on(table.parentId),
  index('org_units_type_idx').on(table.type),
]);
