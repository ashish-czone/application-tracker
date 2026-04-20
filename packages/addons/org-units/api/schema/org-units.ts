import { pgTable, text, integer, timestamp, index, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';
import { orgUnitLevels } from './org-unit-levels';

export const orgUnits = pgTable('org_units', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  name: text('name').notNull(),
  description: text('description'),
  parentId: text('parent_id').references((): AnyPgColumn => orgUnits.id),
  levelId: text('level_id').notNull().references(() => orgUnitLevels.id),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table) => [
  index('org_units_parent_id_idx').on(table.parentId),
  index('org_units_level_id_idx').on(table.levelId),
]);
