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

export interface UserRoleRecord {
  userId: string;
  roleId: string;
}

export interface RoleDelegate {
  findUnique(args: {
    where: { id?: string; name?: string };
    include?: Record<string, unknown>;
  }): Promise<(RoleRecord & Record<string, unknown>) | null>;
  findMany(args?: {
    orderBy?: Record<string, string>;
  }): Promise<RoleRecord[]>;
  create(args: {
    data: Omit<RoleRecord, 'id'>;
  }): Promise<RoleRecord>;
  update(args: {
    where: { id: string };
    data: Partial<Omit<RoleRecord, 'id'>>;
  }): Promise<RoleRecord>;
  delete(args: {
    where: { id: string };
  }): Promise<RoleRecord>;
}

export interface PermissionDelegate {
  findUnique(args: {
    where: { id?: string; resource_action?: { resource: string; action: string } };
  }): Promise<PermissionRecord | null>;
  findMany(args?: {
    orderBy?: Record<string, string>;
  }): Promise<PermissionRecord[]>;
  create(args: {
    data: Omit<PermissionRecord, 'id'>;
  }): Promise<PermissionRecord>;
  upsert(args: {
    where: { resource_action: { resource: string; action: string } };
    create: Omit<PermissionRecord, 'id'>;
    update: Partial<Omit<PermissionRecord, 'id'>>;
  }): Promise<PermissionRecord>;
}

export interface RolePermissionDelegate {
  findMany(args?: {
    where?: Partial<RolePermissionRecord>;
    include?: Record<string, unknown>;
  }): Promise<(RolePermissionRecord & Record<string, unknown>)[]>;
  createMany(args: {
    data: RolePermissionRecord[];
    skipDuplicates?: boolean;
  }): Promise<{ count: number }>;
  deleteMany(args: {
    where: Partial<RolePermissionRecord>;
  }): Promise<{ count: number }>;
}

export interface UserRoleDelegate {
  findMany(args?: {
    where?: Partial<UserRoleRecord>;
    include?: Record<string, unknown>;
  }): Promise<(UserRoleRecord & Record<string, unknown>)[]>;
  create(args: {
    data: UserRoleRecord;
  }): Promise<UserRoleRecord>;
  delete(args: {
    where: { userId_roleId: { userId: string; roleId: string } };
  }): Promise<UserRoleRecord>;
  deleteMany(args: {
    where: Partial<UserRoleRecord>;
  }): Promise<{ count: number }>;
}

export interface RbacModuleConfig {
  entityName: string;
  getRoleDelegate: () => RoleDelegate;
  getPermissionDelegate: () => PermissionDelegate;
  getRolePermissionDelegate: () => RolePermissionDelegate;
  getUserRoleDelegate: () => UserRoleDelegate;
}
