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
export type PermissionScope = 'all' | 'team' | 'own' | `scope:${string}`;

/** Map of permission name → scope (e.g. { "users.read": "all", "users.update": "own", "job-openings.read": "scope:hiring-manager" }) */
export type ScopedPermissions = Record<string, PermissionScope>;

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
