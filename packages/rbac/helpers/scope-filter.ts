import { eq, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import type { PermissionScope } from '../types';

/**
 * Returns a SQL filter condition based on the permission scope.
 * Fails closed: only 'all' explicitly grants unrestricted access.
 * Any unrecognized or undefined scope defaults to 'own' (restricted).
 *
 * - 'all' → no filter (returns undefined)
 * - 'own', undefined, or any unrecognized value → filters to own records
 *
 * Usage in services:
 * ```ts
 * const conditions = [isNull(users.deletedAt)];
 * const scopeCondition = scopeFilter(users.createdBy, permissions['users.read'], actorId);
 * if (scopeCondition) conditions.push(scopeCondition);
 * ```
 */
export function scopeFilter(
  ownerColumn: PgColumn,
  scope: PermissionScope | undefined,
  actorId: string,
): SQL | undefined {
  if (scope === 'all') return undefined;
  // 'own', undefined, or any unrecognized value → restrict to own records
  return eq(ownerColumn, actorId);
}
