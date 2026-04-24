import type { JwtPayload } from '@packages/auth-core';

/**
 * A single scope value attached to a permission grant. Mirrors `ScopeSpec`
 * in `./types`, exposed here as the canonical name for use downstream of
 * JWT resolution where the scope travels with the user's access context.
 */
export interface AccessScopeSpec {
  type: string;
  params?: Record<string, unknown>;
}

/**
 * The resolved access posture for a single (user, permission) pair, ready to
 * be passed to a service method for scope enforcement.
 *
 * `scopes` is OR-ed when a service turns it into a SQL WHERE clause. The
 * special scope `{ type: 'any' }` short-circuits to "no filter".
 */
export interface DataAccessContext {
  userId: string;
  scopes: AccessScopeSpec[];
}

type JwtPermissionValue = AccessScopeSpec[] | true;

/**
 * Build the access context for a verb from the user's JWT.
 *
 * Scopes are attached to the role-permission grant; the JWT carries them as
 * `permissions[<name>]: ScopeSpec[]`. Wildcard `*` and legacy boolean `true`
 * grants collapse to `[{ type: 'any' }]` (unrestricted).
 *
 * Returns `undefined` when the user holds no grant for the permission — the
 * upstream `RbacGuard` rejects that case first, so the access context is
 * only built for authorised callers. Services that receive `undefined` skip
 * scope filtering.
 */
export function buildAccessContext(
  user: JwtPayload,
  permission: string,
): DataAccessContext | undefined {
  const permissions = (user as { permissions?: Record<string, JwtPermissionValue> }).permissions;
  if (!permissions) return undefined;

  if ('*' in permissions) return { userId: user.userId, scopes: [{ type: 'any' }] };

  const value = permissions[permission];
  if (value === undefined) return undefined;

  // Legacy boolean grant (pre-scope) → treated as unrestricted.
  if (value === true) return { userId: user.userId, scopes: [{ type: 'any' }] };

  // Empty array means the user has the grant but no scopes resolved — deny.
  return { userId: user.userId, scopes: value };
}
