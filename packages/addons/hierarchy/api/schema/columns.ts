import { text, integer } from 'drizzle-orm/pg-core';

/**
 * Mixin columns for hierarchical tables.
 * Provides adjacency list (parentId) + materialized path (path, depth).
 *
 * Usage in a Drizzle table definition:
 * ```
 * import { hierarchyColumns } from '@packages/hierarchy';
 *
 * export const categories = pgTable('categories', {
 *   id: text('id').primaryKey(),
 *   name: text('name').notNull(),
 *   ...hierarchyColumns(),
 * });
 * ```
 *
 * @param selfRef - Optional self-referencing table for the parentId foreign key.
 *                  If not provided, parentId is a plain text column without a FK constraint.
 */
export function hierarchyColumns(selfRef?: any) {
  const parentId = selfRef
    ? text('parent_id').references(() => selfRef.id, { onDelete: 'cascade' })
    : text('parent_id');

  return {
    parentId,
    path: text('path').notNull().default('/'),
    depth: integer('depth').notNull().default(0),
  };
}