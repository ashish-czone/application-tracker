export interface RoleRecord {
  id: string;
  name: string;
  description?: string | null;
}

export interface PermissionRecord {
  id: string;
  resource: string;
  action: string;
  description?: string | null;
}

export interface RolePermissionRecord {
  roleId: string;
  permissionId: string;
}

export interface IdentityRoleRecord {
  identityId: string;
  roleId: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface RoleDelegate {
  findUnique(args: any): Promise<any>;
  findMany(args?: any): Promise<any[]>;
  create(args: any): Promise<any>;
  update(args: any): Promise<any>;
  delete(args: any): Promise<any>;
}

export interface PermissionDelegate {
  findUnique(args: any): Promise<any>;
  findMany(args?: any): Promise<any[]>;
  create(args: any): Promise<any>;
  upsert(args: any): Promise<any>;
}

export interface RolePermissionDelegate {
  findMany(args?: any): Promise<any[]>;
  createMany(args: any): Promise<{ count: number }>;
  deleteMany(args: any): Promise<{ count: number }>;
}

export interface IdentityRoleDelegate {
  findMany(args?: any): Promise<any[]>;
  create(args: any): Promise<any>;
  delete(args: any): Promise<any>;
  deleteMany(args: any): Promise<{ count: number }>;
}

/* eslint-enable @typescript-eslint/no-explicit-any */

export interface RbacModuleConfig {
  entityName: string;
  getRoleDelegate: () => RoleDelegate;
  getPermissionDelegate: () => PermissionDelegate;
  getRolePermissionDelegate: () => RolePermissionDelegate;
  getIdentityRoleDelegate: () => IdentityRoleDelegate;
}
