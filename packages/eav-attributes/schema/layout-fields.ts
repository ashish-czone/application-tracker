import { pgTable, text, integer, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';
import { layoutSections } from './layout-sections';
import { fieldDefinitions } from './field-definitions';

export const layoutFields = pgTable('layout_fields', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  sectionId: text('section_id').notNull().references(() => layoutSections.id, { onDelete: 'cascade' }),
  fieldId: text('field_id').notNull().references(() => fieldDefinitions.id, { onDelete: 'cascade' }),
  sortOrder: integer('sort_order').notNull().default(0),
  columnIndex: integer('column_index').notNull().default(0),
}, (table) => [
  uniqueIndex('layout_fields_section_id_field_id_key').on(table.sectionId, table.fieldId),
  index('layout_fields_section_id_idx').on(table.sectionId),
]);
