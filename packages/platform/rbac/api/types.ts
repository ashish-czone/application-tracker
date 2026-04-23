export interface Role {
  id: string;
  name: string;
  userType: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoleMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  addedAt: Date;
}

/** Role with computed isSystem flag (true when role has wildcard '*' permission) */
export interface RoleWithSystem extends Role {
  isSystem: boolean;
}

/**
 * A single scope value attached to a permission grant. Multiple scopes on the
 * same grant are OR'd at enforcement. `type` names a scope kind — `any`, `own`,
 * `assigned`, `unit`, `descendants`, or an entity-registered custom key.
 * `params` is reserved for parameterised scopes (e.g. specific unit id); most
 * built-in scopes have no params.
 */
export interface ScopeSpec {
  type: string;
  params?: Record<string, unknown>;
}

/** Built-in scope types the platform understands out of the box. */
export const BUILT_IN_SCOPE_TYPES = ['any', 'own', 'assigned', 'unit', 'descendants'] as const;
export type BuiltInScopeType = typeof BUILT_IN_SCOPE_TYPES[number];

/**
 * User's effective permissions map: permission name → the scopes they hold for
 * that permission across all their roles. The array is the union of scopes
 * from every grant; `[{type:'any'}]` means unrestricted on rows.
 */
export type ScopedPermissions = Record<string, ScopeSpec[]>;

/** @deprecated Legacy string scope format. Replaced by ScopeSpec. */
export type PermissionScope = 'all' | 'team' | 'own' | `scope:${string}`;

/**
 * @deprecated Use ScopedPermissions (permission → ScopeSpec[]). Kept only for
 * backward-compatibility with callers that treat permissions as boolean keys
 * and rely on key presence rather than values.
 */
export type BooleanPermissions = Record<string, true>;

export interface PermissionRegistryEntry {
  module: string;
  action: string;
  description: string;
}

/** Minimal interface for resolving entity metadata needed by field permissions. */
export interface FieldPermissionEntityResolver {
  /** Get the slug and fieldMeta for an entity type. Returns undefined if not found. */
  resolve(entityType: string): { slug: string; fieldMeta: Record<string, { isSystem?: boolean }> } | undefined;
}

/** DI token for FieldPermissionEntityResolver */
export const FIELD_PERMISSION_ENTITY_RESOLVER = Symbol('FIELD_PERMISSION_ENTITY_RESOLVER');
