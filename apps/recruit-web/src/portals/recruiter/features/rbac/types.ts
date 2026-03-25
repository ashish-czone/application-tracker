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
  scope: 'own' | 'all';
}

export interface PermissionRegistryEntry {
  module: string;
  action: string;
  description: string;
}

/** Map of permission name → scope */
export type ScopedPermissions = Record<string, 'own' | 'all'>;

export interface ListRolesParams {
  page?: number;
  limit?: number;
  search?: string;
  userType?: string;
  sort?: 'name' | 'createdAt';
  order?: 'asc' | 'desc';
}
