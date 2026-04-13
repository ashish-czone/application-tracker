export interface Role {
  id: string;
  name: string;
  userType: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Role with computed isSystem flag (true when role has wildcard '*' permission) */
export interface RoleWithSystem extends Role {
  isSystem: boolean;
}

/** Built-in scopes + custom entity-defined scopes (prefixed with 'scope:') */
/** @deprecated Scope is now determined by org positions, not RBAC permissions */
export type PermissionScope = 'all' | 'team' | 'own' | `scope:${string}`;

/** @deprecated Use BooleanPermissions instead — scope is now determined by org positions */
export type ScopedPermissions = Record<string, PermissionScope>;

/** Map of permission name → true (scope is no longer embedded in permissions) */
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
