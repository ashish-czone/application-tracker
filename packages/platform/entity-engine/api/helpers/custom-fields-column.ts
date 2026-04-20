import { jsonb } from 'drizzle-orm/pg-core';

/**
 * Drizzle column helper for JSONB custom-fields storage. Spread into a `pgTable`
 * column object to opt the table into the JSONB custom-fields primitive:
 *
 * ```ts
 * export const posts = pgTable('posts', {
 *   id: text('id').primaryKey(),
 *   title: text('title').notNull(),
 *   ...customFieldsColumn(),
 * });
 * ```
 *
 * Produces a single column:
 * - `custom_fields` — `jsonb`, NOT NULL, default `{}`. Holds all admin-defined
 *   custom field values keyed by `field_key`. The column is always at least
 *   `{}`; storage and read paths never need to handle NULL.
 *
 * Entity-engine's `defineEntity({ customFields: true })` requires this column.
 * Use `customFields: 'eav'` to opt into legacy EAV storage (no column needed),
 * or omit the flag for an entity without custom fields.
 */
export function customFieldsColumn() {
  return {
    customFields: jsonb('custom_fields').notNull().default({}),
  };
}

/**
 * Runtime check that a Drizzle table has the column produced by
 * `customFieldsColumn()`. Used by `defineEntity()` to validate shape at startup
 * when `customFields: true` (JSONB mode) is requested.
 */
export function hasCustomFieldsColumn(columns: Record<string, unknown>): boolean {
  return !!columns.customFields;
}
