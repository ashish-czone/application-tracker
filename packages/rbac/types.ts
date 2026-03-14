export interface RoleRecord {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PermissionRecord {
  id: string;
  resource: string;
  action: string;
  description: string | null;
  createdAt: Date;
}

export interface RolePermissionRecord {
  roleId: string;
  permissionId: string;
  createdAt: Date;
}

export interface IdentityRoleRecord {
  identityId: string;
  roleId: string;
  createdAt: Date;
}

export interface RoleDelegate {
  findById(id: string): Promise<RoleRecord | null>;
  findByName(name: string): Promise<RoleRecord | null>;
  findAll(orderBy?: { field: string; direction: 'asc' | 'desc' }): Promise<RoleRecord[]>;
  create(data: { name: string; description?: string }): Promise<RoleRecord>;
  update(id: string, data: { name?: string; description?: string }): Promise<RoleRecord>;
  delete(id: string): Promise<void>;
}

export interface PermissionDelegate {
  findAll(orderBy?: { field: string; direction: 'asc' | 'desc' }): Promise<PermissionRecord[]>;
  upsert(data: { resource: string; action: string; description?: string }): Promise<PermissionRecord>;
}

export interface RolePermissionDelegate {
  findByRoleId(roleId: string): Promise<(RolePermissionRecord & { permission: PermissionRecord })[]>;
  setForRole(roleId: string, permissionIds: string[]): Promise<void>;
}

export interface IdentityRoleDelegate {
  findByIdentityId(identityId: string): Promise<(IdentityRoleRecord & { role: RoleRecord })[]>;
  findRoleIdsByIdentityId(identityId: string): Promise<string[]>;
  create(data: { identityId: string; roleId: string }): Promise<IdentityRoleRecord>;
  delete(identityId: string, roleId: string): Promise<void>;
}

export interface RbacModuleConfig {
  entityName: string;
  getRoleDelegate: () => RoleDelegate;
  getPermissionDelegate: () => PermissionDelegate;
  getRolePermissionDelegate: () => RolePermissionDelegate;
  getIdentityRoleDelegate: () => IdentityRoleDelegate;
}
