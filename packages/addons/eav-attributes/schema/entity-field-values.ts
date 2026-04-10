import { pgTable, text, timestamp, boolean, numeric, date, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';

export const entityFieldValues = pgTable('entity_field_values', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  fieldKey: text('field_key').notNull(),

  // Typed value columns — only one is populated per row
  valueText: text('value_text'),
  valueNumber: numeric('value_number'),
  valueDate: date('value_date', { mode: 'string' }),
  valueDatetime: timestamp('value_datetime', { withTimezone: true, mode: 'date' }),
  valueBoolean: boolean('value_boolean'),

  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex('entity_field_values_entity_field_key').on(table.entityType, table.entityId, table.fieldKey),
  index('entity_field_values_entity_lookup_idx').on(table.entityType, table.entityId),
  index('entity_field_values_text_search_idx').on(table.entityType, table.fieldKey, table.valueText),
  index('entity_field_values_number_search_idx').on(table.entityType, table.fieldKey, table.valueNumber),
  index('entity_field_values_date_search_idx').on(table.entityType, table.fieldKey, table.valueDate),
  index('entity_field_values_boolean_search_idx').on(table.entityType, table.fieldKey, table.valueBoolean),
]);
