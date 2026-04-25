import { integer } from 'drizzle-orm/pg-core';

/**
 * Mixin column for orderable tables. Provides a single `sort_order` integer
 * used for absolute sibling ordering.
 *
 * Usage in a Drizzle table definition:
 * ```
 * import { orderableColumns } from '@packages/orderable';
 *
 * export const menuItems = pgTable('menu_items', {
 *   id: text('id').primaryKey(),
 *   label: text('label').notNull(),
 *   ...orderableColumns(),
 * });
 * ```
 *
 * The column defaults to 0. Clients pick absolute integer values for ordering
 * (typically midpoints between neighbours). List queries on orderable entities
 * default to `sort_order ASC, id ASC` as a stable tiebreak.
 */
export function orderableColumns() {
  return {
    sortOrder: integer('sort_order').notNull().default(0),
  };
}
