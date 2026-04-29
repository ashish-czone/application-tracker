import { pgTable, text, boolean, integer, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';
import { fieldDefinitions } from './field-definitions';

export const picklistOptions = pgTable('picklist_options', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  fieldId: text('field_id').notNull().references(() => fieldDefinitions.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  value: text('value').notNull(),
  isDefault: boolean('is_default').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
}, (table) => [
  uniqueIndex('picklist_options_field_id_value_key').on(table.fieldId, table.value),
  index('picklist_options_field_id_idx').on(table.fieldId),
]);
