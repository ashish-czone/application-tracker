export interface Role {
  id: string;
  name: string;
  userType: 'admin' | 'client';
  isDefault: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRoleRequest {
  name: string;
  userType: 'admin' | 'client';
  isDefault?: boolean;
}

export interface UpdateRoleRequest {
  name: string;
}

export interface PermissionEntry {
  name: string;
}

export interface PermissionRegistryEntry {
  module: string;
  action: string;
  description: string;
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
