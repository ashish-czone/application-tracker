import { pgTable, text, timestamp, boolean, integer, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';

export const layoutSections = pgTable('layout_sections', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  entityType: text('entity_type').notNull(),
  layoutName: text('layout_name').notNull().default('Standard'),
  name: text('name').notNull(),
  columns: integer('columns').notNull().default(2),
  sortOrder: integer('sort_order').notNull().default(0),
  isCollapsible: boolean('is_collapsible').notNull().default(true),
  isTabular: boolean('is_tabular').notNull().default(false),
  tabularMaxRows: integer('tabular_max_rows'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('layout_sections_entity_layout_name_key').on(table.entityType, table.layoutName, table.name),
  index('layout_sections_entity_type_idx').on(table.entityType, table.layoutName),
]);
