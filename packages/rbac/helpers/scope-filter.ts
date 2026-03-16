import { eq, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import type { PermissionScope } from '../types';

/**
 * Returns a SQL filter condition based on the permission scope.
 *
 * - 'own' → filters to rows where ownerColumn matches actorId
 * - 'all' → no filter (returns undefined)
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
  if (scope === 'own') return eq(ownerColumn, actorId);
  // 'all' or undefined → no filter
  return undefined;
}
