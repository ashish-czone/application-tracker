import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RbacService } from '../rbac.service';
import { PermissionRegistryService } from '../permission-registry.service';

vi.mock('@packages/tenancy/helpers', () => ({
  withTenant: vi.fn((_table: unknown, ...conditions: unknown[]) => conditions[0]),
  withTenantInsert: vi.fn((_table: unknown, data: unknown) => data),
}));

/**
 * Creates a mock DB where every method returns `self` (chainable) by default.
 * Use `pushWhereResult(value)` to queue a resolved value for the next `where()` call.
 * When a queued value exists, `where()` returns a thenable that also exposes chainable methods.
 * Use `pushOffsetResult(value)` similarly for `offset()`.
 */
function createMockDb() {
  const chain: Record<string, any> = {};

  chain.select = vi.fn().mockReturnValue(chain);
  chain.from = vi.fn().mockReturnValue(chain);
  chain.innerJoin = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.values = vi.fn().mockReturnValue(chain);
  chain.set = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn().mockResolvedValue([]);
  chain.onConflictDoNothing = vi.fn().mockResolvedValue(undefined);

  const whereQueue: any[] = [];
  chain.where = vi.fn().mockImplementation(() => {
    if (whereQueue.length > 0) {
      const result = whereQueue.shift();
      // Return a thenable that also has chain methods so both patterns work:
      //   await db.select().from().where()          -- thenable
      //   db.select().from().where().orderBy()...    -- chainable
      return {
        then: (resolve: any, reject?: any) => Promise.resolve(result).then(resolve, reject),
        orderBy: chain.orderBy,
        limit: chain.limit,
        offset: chain.offset,
        innerJoin: chain.innerJoin,
      };
    }
    return chain;
  });

  const offsetQueue: any[] = [];
  chain.offset = vi.fn().mockImplementation(() => {
    if (offsetQueue.length > 0) {
      const result = offsetQueue.shift();
      return Promise.resolve(result);
    }
    return chain;
  });

  return {
    db: chain,
    _chain: chain,
    pushWhereResult: (val: any) => whereQueue.push(val),
    pushOffsetResult: (val: any) => offsetQueue.push(val),
  };
}

const now = new Date();

function makeRole(overrides?: Partial<{ id: string; name: string; userType: string; isDefault: boolean }>) {
  return {
    id: 'role-1',
    name: 'Staff',
    userType: 'client',
    isDefault: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('RbacService — additional coverage', () => {
  let service: RbacService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    const permissionRegistry = {
      register: vi.fn(),
      getAll: vi.fn(),
      getByModule: vi.fn(),
      has: vi.fn(),
    } as any;
    service = new RbacService(mockDb as any, permissionRegistry);
  });

  // ----------------------------------------------------------------
  // getRoleUserCount
  // ----------------------------------------------------------------
  describe('getRoleUserCount', () => {
    it('should return the count of users assigned to a role', async () => {
      mockDb.pushWhereResult([{ total: 7 }]);

      const result = await service.getRoleUserCount('role-1');

      expect(result).toBe(7);
      expect(mockDb._chain.select).toHaveBeenCalled();
      expect(mockDb._chain.from).toHaveBeenCalled();
    });

    it('should return 0 when no users are assigned', async () => {
      mockDb.pushWhereResult([{ total: 0 }]);

      const result = await service.getRoleUserCount('role-1');

      expect(result).toBe(0);
    });

    it('should coerce string total to number', async () => {
      mockDb.pushWhereResult([{ total: '3' }]);

      const result = await service.getRoleUserCount('role-1');

      expect(result).toBe(3);
      expect(typeof result).toBe('number');
    });
  });

  // ----------------------------------------------------------------
  // findRolesByUserType
  // ----------------------------------------------------------------
  describe('findRolesByUserType', () => {
    it('should return roles matching the userType', async () => {
      const roles = [makeRole({ id: 'r1', name: 'Admin' }), makeRole({ id: 'r2', name: 'Editor' })];
      mockDb.pushWhereResult(roles);

      const result = await service.findRolesByUserType('client');

      expect(result).toEqual(roles);
      expect(result).toHaveLength(2);
    });

    it('should return an empty array when no roles exist for the userType', async () => {
      mockDb.pushWhereResult([]);

      const result = await service.findRolesByUserType('nonexistent');

      expect(result).toEqual([]);
    });
  });

  // ----------------------------------------------------------------
  // listRoles
  // ----------------------------------------------------------------
  describe('listRoles', () => {
    it('should return paginated roles with meta', async () => {
      const roleData = [makeRole({ id: 'r1', name: 'Staff' })];
      // 1st where = count query (awaited)
      mockDb.pushWhereResult([{ total: 1 }]);
      // 2nd where = data query (chains to .orderBy().limit().offset(), never awaited directly)
      mockDb.pushWhereResult('chainable');
      // offset resolves to the data
      mockDb.pushOffsetResult(roleData);
      // 3rd where = getSystemRoleIds (awaited)
      mockDb.pushWhereResult([]);

      const result = await service.listRoles({});

      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(25);
      expect(result.meta.totalPages).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toHaveProperty('isSystem', false);
    });

    it('should apply search filter', async () => {
      mockDb.pushWhereResult([{ total: 0 }]);
      mockDb.pushWhereResult('chainable');
      mockDb.pushOffsetResult([]);

      const result = await service.listRoles({ search: 'admin' });

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });

    it('should apply userType filter', async () => {
      const roleData = [makeRole({ id: 'r1', userType: 'admin' })];
      mockDb.pushWhereResult([{ total: 1 }]);
      mockDb.pushWhereResult('chainable');
      mockDb.pushOffsetResult(roleData);
      mockDb.pushWhereResult([]);

      const result = await service.listRoles({ userType: 'admin' });

      expect(result.data).toHaveLength(1);
    });

    it('should compute correct pagination offset', async () => {
      mockDb.pushWhereResult([{ total: 50 }]);
      mockDb.pushWhereResult('chainable');
      mockDb.pushOffsetResult([]);

      const result = await service.listRoles({ page: 3, limit: 10 });

      expect(result.meta.page).toBe(3);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.totalPages).toBe(5);
    });

    it('should mark system roles with isSystem=true', async () => {
      const roleData = [makeRole({ id: 'r1' }), makeRole({ id: 'r2' })];
      mockDb.pushWhereResult([{ total: 2 }]);
      mockDb.pushWhereResult('chainable');
      mockDb.pushOffsetResult(roleData);
      // getSystemRoleIds returns r1 as having wildcard permission
      mockDb.pushWhereResult([{ roleId: 'r1' }]);

      const result = await service.listRoles({});

      expect(result.data[0].isSystem).toBe(true);
      expect(result.data[1].isSystem).toBe(false);
    });

    it('should return empty data when no roles exist', async () => {
      mockDb.pushWhereResult([{ total: 0 }]);
      mockDb.pushWhereResult('chainable');
      mockDb.pushOffsetResult([]);

      const result = await service.listRoles({});

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });

    it('should sort by name ascending', async () => {
      mockDb.pushWhereResult([{ total: 0 }]);
      mockDb.pushWhereResult('chainable');
      mockDb.pushOffsetResult([]);

      await service.listRoles({ sort: 'name', order: 'asc' });

      expect(mockDb._chain.orderBy).toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------
  // getRolePermissions
  // ----------------------------------------------------------------
  describe('getRolePermissions', () => {
    it('should return BooleanPermissions from rolePermissions table', async () => {
      mockDb.pushWhereResult([
        { permission: 'users.read' },
        { permission: 'users.write' },
        { permission: 'orders.read' },
      ]);

      const result = await service.getRolePermissions('role-1');

      expect(result).toEqual({
        'users.read': true,
        'users.write': true,
        'orders.read': true,
      });
    });

    it('should return empty object when role has no permissions', async () => {
      mockDb.pushWhereResult([]);

      const result = await service.getRolePermissions('role-1');

      expect(result).toEqual({});
    });

    it('should include wildcard permission', async () => {
      mockDb.pushWhereResult([{ permission: '*' }]);

      const result = await service.getRolePermissions('role-1');

      expect(result).toEqual({ '*': true });
    });

    it('should deduplicate duplicate permission entries', async () => {
      mockDb.pushWhereResult([
        { permission: 'users.read' },
        { permission: 'users.read' },
      ]);

      const result = await service.getRolePermissions('role-1');

      expect(result).toEqual({ 'users.read': true });
      expect(Object.keys(result)).toHaveLength(1);
    });
  });

  // ----------------------------------------------------------------
  // removeRoleFromUser
  // ----------------------------------------------------------------
  describe('removeRoleFromUser', () => {
    it('should delete the user-role association', async () => {
      await service.removeRoleFromUser('user-1', 'role-1');

      expect(mockDb._chain.delete).toHaveBeenCalled();
      expect(mockDb._chain.where).toHaveBeenCalled();
    });

    it('should not throw when the association does not exist', async () => {
      await expect(service.removeRoleFromUser('user-1', 'nonexistent')).resolves.toBeUndefined();
    });
  });

  // ----------------------------------------------------------------
  // getUserRoles
  // ----------------------------------------------------------------
  describe('getUserRoles', () => {
    it('should return roles for a user', async () => {
      const expectedRoles = [
        { id: 'r1', name: 'Admin', userType: 'client', isDefault: false, createdAt: now, updatedAt: now },
        { id: 'r2', name: 'Editor', userType: 'client', isDefault: false, createdAt: now, updatedAt: now },
      ];
      mockDb.pushWhereResult(expectedRoles);

      const result = await service.getUserRoles('user-1');

      expect(result).toEqual(expectedRoles);
      expect(result).toHaveLength(2);
      expect(mockDb._chain.innerJoin).toHaveBeenCalled();
    });

    it('should return empty array when user has no roles', async () => {
      mockDb.pushWhereResult([]);

      const result = await service.getUserRoles('user-1');

      expect(result).toEqual([]);
    });

    it('should filter by userType when provided', async () => {
      const expectedRoles = [
        { id: 'r1', name: 'Admin', userType: 'admin', isDefault: false, createdAt: now, updatedAt: now },
      ];
      mockDb.pushWhereResult(expectedRoles);

      const result = await service.getUserRoles('user-1', 'admin');

      expect(result).toEqual(expectedRoles);
      expect(result[0].userType).toBe('admin');
    });

    it('should return roles without userType filter when not provided', async () => {
      const expectedRoles = [
        { id: 'r1', name: 'Admin', userType: 'admin', isDefault: false, createdAt: now, updatedAt: now },
        { id: 'r2', name: 'Client', userType: 'client', isDefault: true, createdAt: now, updatedAt: now },
      ];
      mockDb.pushWhereResult(expectedRoles);

      const result = await service.getUserRoles('user-1');

      expect(result).toHaveLength(2);
    });
  });
});
