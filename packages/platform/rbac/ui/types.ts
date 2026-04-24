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
