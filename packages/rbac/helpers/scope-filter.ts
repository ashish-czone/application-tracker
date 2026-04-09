import { eq, inArray, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import type { PermissionScope } from '../types';

/**
 * Returns a SQL filter condition based on the permission scope.
 * Fails closed: only 'all' explicitly grants unrestricted access.
 * Any unrecognized or undefined scope defaults to 'own' (restricted).
 *
 * Built-in scopes:
 * - 'all' → no filter (returns undefined)
 * - 'own' → filters to own records (ownerColumn = actorId)
 * - 'team' → filters to team records (ownerColumn IN teamUserIds)
 * - 'scope:*' → returns null (custom scope, handled by entity engine)
 *
 * When the return value is null, the caller MUST apply a custom scope resolver.
 * This distinguishes "no filter needed" (undefined) from "custom filter needed" (null).
 */
export function scopeFilter(
  ownerColumn: PgColumn,
  scope: PermissionScope | undefined,
  actorId: string,
  teamUserIds?: string[],
): SQL | undefined | null {
  if (scope === 'all') return undefined;
  if (scope === 'team' && teamUserIds) return inArray(ownerColumn, teamUserIds);
  if (scope?.startsWith('scope:')) return null; // signal: entity engine must resolve
  // 'own', undefined, or any unrecognized value → restrict to own records
  return eq(ownerColumn, actorId);
}

/**
 * Extracts the custom scope key from a scope string.
 * Returns undefined if the scope is not a custom scope.
 * e.g. 'scope:hiring-manager' → 'hiring-manager'
 */
export function extractCustomScopeKey(scope: PermissionScope | undefined): string | undefined {
  if (scope?.startsWith('scope:')) return scope.slice(6);
  return undefined;
}
