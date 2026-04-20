import { isNull, type SQL } from 'drizzle-orm';
import { hasSoftDeleteColumns } from './columns';

/**
 * WHERE-clause helper for soft-delete-aware reads. Returns
 * `deleted_at IS NULL`, i.e. "only live rows".
 *
 * ```ts
 * await db.select().from(roles).where(and(eq(roles.id, id), notDeleted(roles)));
 * ```
 *
 * Throws if the table was not declared with `...softDeleteColumns()` — callers
 * that are not sure whether a table is soft-deletable should gate this call
 * themselves (or use the generic filter in `buildSoftDeleteCondition`).
 */
export function notDeleted(table: unknown): SQL {
  if (!hasSoftDeleteColumns(table)) {
    throw new Error(
      'notDeleted(): table is missing deletedAt column. Spread ...softDeleteColumns() in the table definition.',
    );
  }
  return isNull((table as { deletedAt: unknown }).deletedAt as never);
}

/**
 * Same as `notDeleted()`, but returns `null` instead of throwing when the table
 * is not soft-deletable, and honors an `includeDeleted` flag. Convenient when
 * building conditional WHERE clauses in a generic CRUD service that handles
 * both soft and hard entities.
 *
 * Returns `null` when either the table has no `deletedAt` column, or
 * `includeDeleted === true` — callers should skip adding it to the conditions
 * array in that case.
 */
export function buildSoftDeleteCondition(
  table: unknown,
  includeDeleted = false,
): SQL | null {
  if (includeDeleted || !hasSoftDeleteColumns(table)) return null;
  return isNull((table as { deletedAt: unknown }).deletedAt as never);
}
