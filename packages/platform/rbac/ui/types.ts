export interface Role {
  id: string;
  name: string;
  userType: string | null;
  isDefault: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRoleRequest {
  name: string;
  userType?: string | null;
  isDefault?: boolean;
}

export interface RoleMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  addedAt: string;
}

export interface ListRoleMembersParams {
  page?: number;
  limit?: number;
  search?: string;
}

/**
 * Typeahead row returned by `GET /roles/options`. Mirrors the shape of
 * compliance's `/clients/options` and `/laws/options` — id + label
 * fields shaped for picker dropdowns. `userType` is included so
 * client-side picker UIs can filter or group by audience without a
 * follow-up call.
 */
export interface RoleOption {
  id: string;
  name: string;
  userType: string | null;
}

export interface RoleOptionsParams {
  /** Substring query — server ILIKEs role name. */
  search?: string;
  /**
   * Hydrate labels for already-selected chips. When present, server bypasses
   * `search` and returns only rows whose id is in this set, so a reopened
   * page can show its filter chips with names regardless of search state.
   */
  ids?: readonly string[];
  /** Defaults to 25 server-side; clamped to 50 max. */
  limit?: number;
  /** Optional userType filter (admin / client / etc). */
  userType?: string;
}

export interface UpdateRoleRequest {
  name: string;
}

export interface PermissionEntry {
  name: string;
}

export interface PermissionManifest {
  slug: string;
  module: string;
  action: string;
  label: string;
  description?: string;
  supportedScopes: string[];
}

/** Map of permission name → true (scope is determined by org positions, not permissions) */
export type BooleanPermissions = Record<string, true>;

/** @deprecated Use BooleanPermissions instead */
export type ScopedPermissions = Record<string, string>;

export interface ListRolesParams {
  page?: number;
  limit?: number;
  search?: string;
  userType?: string;
  sort?: 'name' | 'createdAt';
  order?: 'asc' | 'desc';
}
