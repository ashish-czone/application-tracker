export interface Role {
  id: string;
  name: string;
  userType: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type PermissionScope = 'own' | 'all';

/** Map of permission name → scope (e.g. { "users.read": "all", "users.update": "own" }) */
export type ScopedPermissions = Record<string, PermissionScope>;

export interface PermissionRegistryEntry {
  module: string;
  action: string;
  description: string;
}
