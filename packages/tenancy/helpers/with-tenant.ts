import { and, eq, sql, type SQL } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { getTenantId } from '@packages/logger';

/**
 * Check whether a Drizzle table has a tenantId column.
 */
function hasTenantColumn(table: PgTable): table is PgTable & { tenantId: any } {
  return 'tenantId' in (table as any);
}

/**
 * Wraps WHERE conditions with a tenant_id filter for SELECT/UPDATE/DELETE queries.
 *
 * When tenancy is active and the table has a tenantId column, the tenant filter
 * is ANDed with the provided conditions. Otherwise, returns conditions as-is.
 *
 * @example
 * // SELECT with conditions
 * db.select().from(users).where(withTenant(users, eq(users.status, 'active')))
 *
 * // SELECT with no other conditions
 * db.select().from(users).where(withTenant(users))
 *
 * // UPDATE
 * db.update(users).set({ name }).where(withTenant(users, eq(users.id, id)))
 *
 * // DELETE
 * db.delete(users).where(withTenant(users, eq(users.id, id)))
 */
export function withTenant(table: PgTable, ...conditions: (SQL | undefined)[]): SQL | undefined {
  const tenantId = getTenantId();
  const parts = conditions.filter(Boolean) as SQL[];

  if (tenantId && hasTenantColumn(table)) {
    return and(eq(table.tenantId, tenantId), ...parts);
  }

  return parts.length > 0 ? and(...parts) : undefined;
}

/**
 * Injects tenantId into INSERT values when tenancy is active.
 *
 * When tenancy is not active or the table has no tenantId column, returns data as-is.
 *
 * @example
 * db.insert(users).values(withTenantInsert(users, { name, email }))
 *
 * // Array of values
 * db.insert(users).values(withTenantInsert(users, [{ name: 'a' }, { name: 'b' }]))
 */
export function withTenantInsert<T extends Record<string, unknown>>(
  table: PgTable,
  data: T,
): T;
export function withTenantInsert<T extends Record<string, unknown>>(
  table: PgTable,
  data: T[],
): T[];
export function withTenantInsert<T extends Record<string, unknown>>(
  table: PgTable,
  data: T | T[],
): T | T[] {
  const tenantId = getTenantId();

  if (!tenantId || !hasTenantColumn(table)) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((row) => ({ ...row, tenantId }));
  }

  return { ...data, tenantId };
}

/**
 * Returns a tenant_id filter condition for use in raw SQL template literals.
 *
 * When tenancy is active, returns `tenant_id = <tenantId>`.
 * When tenancy is not active, returns `TRUE` (no-op in WHERE clauses).
 *
 * @example
 * sql`SELECT COUNT(*) FROM entity_tags WHERE entity_id = ${entityId} AND ${tenantCondition()}`
 */
export function tenantCondition(): SQL {
  const tenantId = getTenantId();

  if (!tenantId) {
    return sql`TRUE`;
  }

  return sql`tenant_id = ${tenantId}`;
}
