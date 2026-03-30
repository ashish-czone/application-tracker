import { pgTable, text, timestamp, boolean, integer, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';

export const fieldDefinitions = pgTable('field_definitions', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  entityType: text('entity_type').notNull(),
  fieldKey: text('field_key').notNull(),
  label: text('label').notNull(),
  fieldType: text('field_type').notNull(),
  uiType: text('ui_type'),

  // Validation & behavior
  isRequired: boolean('is_required').notNull().default(false),
  isSystem: boolean('is_system').notNull().default(false),
  isCustom: boolean('is_custom').notNull().default(false),
  isUnique: boolean('is_unique').notNull().default(false),
  isQuickCreate: boolean('is_quick_create').notNull().default(false),
  isReadonly: boolean('is_readonly').notNull().default(false),
  maxLength: integer('max_length'),
  defaultValue: text('default_value'),

  // Standard field column mapping (NULL = custom field, stored in EAV)
  columnName: text('column_name'),

  // Lookup field config
  lookupEntity: text('lookup_entity'),
  lookupLabelField: text('lookup_label_field'),
  lookupSearchFields: text('lookup_search_fields').array(),

  // Relational field config (tags, file, category)
  tagGroupSlug: text('tag_group_slug'),
  categoryGroupSlug: text('category_group_slug'),
  fileAccept: text('file_accept').array(),
  fileMaxSize: integer('file_max_size'),

  // Metadata
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex('field_definitions_entity_type_field_key_key').on(table.entityType, table.fieldKey),
  index('field_definitions_entity_type_idx').on(table.entityType),
]);
