import { text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Drizzle column helper for soft-delete. Spread into a `pgTable` column object
 * to opt the table into the soft-delete primitive:
 *
 * ```ts
 * export const roles = pgTable('roles', {
 *   id: text('id').primaryKey(),
 *   name: text('name').notNull(),
 *   ...softDeleteColumns(),
 * });
 * ```
 *
 * Produces two columns:
 * - `deleted_at` — timestamptz, nullable. NULL means the row is live.
 * - `deleted_by` — text, nullable. Actor id that performed the soft-delete.
 *
 * Entity-engine's `defineEntity({ onDelete: { mode: 'soft' } })` requires these
 * columns. Services that wrap `createSoftDeleteExecutor()` manually also need
 * them. For `mode: 'hard'` or `mode: 'restrict'` entities, do NOT spread this.
 */
export function softDeleteColumns() {
  return {
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
    deletedBy: text('deleted_by'),
  };
}

/**
 * Runtime check that a Drizzle table has the columns produced by
 * `softDeleteColumns()`. Used by `defineSoftDeletePolicy()` and the
 * entity-engine's `defineEntity()` to validate shape at startup.
 */
export function hasSoftDeleteColumns(table: unknown): boolean {
  const t = table as Record<string, unknown>;
  return !!t.deletedAt && !!t.deletedBy;
}
