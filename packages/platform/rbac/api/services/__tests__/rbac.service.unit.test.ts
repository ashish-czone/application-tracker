import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { RbacService } from '../rbac.service';
import { PermissionManifestRegistry } from '../../permission-manifest';

// Mock database helpers
function createMockDb() {
  const mockChain: any = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
  };

  const db: any = {
    select: vi.fn().mockReturnValue(mockChain),
    insert: vi.fn().mockReturnValue(mockChain),
    update: vi.fn().mockReturnValue(mockChain),
    delete: vi.fn().mockReturnValue(mockChain),
    _chain: mockChain,
  };
  // Executor opens a transaction. Run the callback with the same mock.
  db.transaction = vi.fn((cb: (tx: any) => Promise<unknown>) => cb(db));
  return db;
}

function createMockDatabaseService(mockDb: ReturnType<typeof createMockDb>) {
  return { db: mockDb } as any;
}

describe('RbacService', () => {
  let service: RbacService;
  let manifestRegistry: PermissionManifestRegistry;
  let mockDb: ReturnType<typeof createMockDb>;

  function seedManifests(slugs: string[]): void {
    manifestRegistry.registerMany(
      slugs.map((slug) => {
        const [module, action] = slug.split('.');
        return { slug, module, action, label: slug, supportedScopes: ['any'] };
      }),
    );
  }

  beforeEach(() => {
    mockDb = createMockDb();
    const databaseService = createMockDatabaseService(mockDb);
    manifestRegistry = new PermissionManifestRegistry();
    service = new RbacService(databaseService, manifestRegistry);
  });

  describe('createRole', () => {
    it('should insert a role and return it', async () => {
      const role = { id: 'role-1', name: 'admin', userType: 'admin', isDefault: false, createdAt: new Date(), updatedAt: new Date() };
      mockDb._chain.returning.mockResolvedValueOnce([role]);

      const result = await service.createRole({ name: 'admin', userType: 'admin' });

      expect(result).toEqual(role);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should create a default role when isDefault is true', async () => {
      const role = { id: 'role-1', name: 'client', userType: 'client', isDefault: true, createdAt: new Date(), updatedAt: new Date() };
      mockDb._chain.returning.mockResolvedValueOnce([role]);

      const result = await service.createRole({ name: 'client', userType: 'client', isDefault: true });

      expect(result.isDefault).toBe(true);
    });
  });

  describe('updateRole', () => {
    it('should update and return the role', async () => {
      vi.spyOn(service, 'isSystemRole').mockResolvedValueOnce(false);
      const role = { id: 'role-1', name: 'updated', userType: 'admin', createdAt: new Date(), updatedAt: new Date() };
      mockDb._chain.returning.mockResolvedValueOnce([role]);

      const result = await service.updateRole('role-1', { name: 'updated' });

      expect(result.name).toBe('updated');
    });

    it('should throw NotFoundException if role not found', async () => {
      vi.spyOn(service, 'isSystemRole').mockResolvedValueOnce(false);
      mockDb._chain.returning.mockResolvedValueOnce([]);

      await expect(service.updateRole('nonexistent', { name: 'x' }))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when updating a system role', async () => {
      vi.spyOn(service, 'isSystemRole').mockResolvedValueOnce(true);

      await expect(service.updateRole('admin-role', { name: 'renamed' }))
        .rejects.toThrow(ConflictException);
    });
  });

  describe('deleteRole', () => {
    it('should soft-delete the role even when users are assigned', async () => {
      const role = { id: 'role-1', name: 'custom', userType: 'admin', isDefault: false, createdAt: new Date(), updatedAt: new Date() };
      vi.spyOn(service, 'findRoleById').mockResolvedValueOnce(role);
      vi.spyOn(service, 'isSystemRole').mockResolvedValueOnce(false);

      await expect(service.deleteRole('role-1', 'actor-1')).resolves.toBeUndefined();
      // Executor hard-deletes user_roles then UPDATEs roles with deleted_at/deleted_by
      expect(mockDb.transaction).toHaveBeenCalled();
      expect(mockDb.delete).toHaveBeenCalled(); // user_roles hardDelete
      expect(mockDb.update).toHaveBeenCalled(); // roles soft-mark
      // role_permissions 'keep' → no delete, no update on that table beyond the role soft-mark
    });

    it('should throw NotFoundException if role not found', async () => {
      vi.spyOn(service, 'findRoleById').mockResolvedValueOnce(null);

      await expect(service.deleteRole('nonexistent', 'actor-1'))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when deleting a system role', async () => {
      const role = { id: 'admin-role', name: 'Admin', userType: 'client', isDefault: false, createdAt: new Date(), updatedAt: new Date() };
      vi.spyOn(service, 'findRoleById').mockResolvedValueOnce(role);
      vi.spyOn(service, 'isSystemRole').mockResolvedValueOnce(true);

      await expect(service.deleteRole('admin-role', 'actor-1'))
        .rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when deleting a default role', async () => {
      const role = { id: 'role-1', name: 'client', userType: 'client', isDefault: true, createdAt: new Date(), updatedAt: new Date() };
      vi.spyOn(service, 'findRoleById').mockResolvedValueOnce(role);
      vi.spyOn(service, 'isSystemRole').mockResolvedValueOnce(false);

      await expect(service.deleteRole('role-1', 'actor-1'))
        .rejects.toThrow(ConflictException);
    });
  });

  describe('findRoleByIdOrFail', () => {
    it('should return role if found', async () => {
      const role = { id: 'role-1', name: 'admin', userType: 'admin', isDefault: false, createdAt: new Date(), updatedAt: new Date() };
      vi.spyOn(service, 'findRoleById').mockResolvedValueOnce(role);

      const result = await service.findRoleByIdOrFail('role-1');
      expect(result).toEqual(role);
    });

    it('should throw NotFoundException if not found', async () => {
      vi.spyOn(service, 'findRoleById').mockResolvedValueOnce(null);

      await expect(service.findRoleByIdOrFail('nonexistent'))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('findRoleById', () => {
    it('should return role if found', async () => {
      const role = { id: 'role-1', name: 'admin', userType: 'admin', createdAt: new Date(), updatedAt: new Date() };
      mockDb._chain.limit.mockResolvedValueOnce([role]);

      const result = await service.findRoleById('role-1');

      expect(result).toEqual(role);
    });

    it('should return null if not found', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      const result = await service.findRoleById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findDefaultRoleForUserType', () => {
    it('should return the default role for a user type', async () => {
      const role = { id: 'role-1', name: 'client', userType: 'client', isDefault: true, createdAt: new Date(), updatedAt: new Date() };
      mockDb._chain.limit.mockResolvedValueOnce([role]);

      const result = await service.findDefaultRoleForUserType('client');

      expect(result).toEqual(role);
    });

    it('should return null if no default role exists', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      const result = await service.findDefaultRoleForUserType('client');

      expect(result).toBeNull();
    });
  });

  describe('getPermissionsForUser', () => {
    it('should return scoped permissions with default any scope when no scope rows', async () => {
      mockDb._chain.where.mockResolvedValueOnce([
        { permission: 'users.read', scopeType: null, scopeParams: null },
        { permission: 'users.update', scopeType: null, scopeParams: null },
      ]);

      const result = await service.getPermissionsForUser('user-1', 'admin');

      expect(result).toEqual({
        'users.read': [{ type: 'any' }],
        'users.update': [{ type: 'any' }],
      });
    });

    it('should aggregate scopes from multiple role grants, collapsing duplicates', async () => {
      mockDb._chain.where.mockResolvedValueOnce([
        { permission: 'tasks.update', scopeType: 'own', scopeParams: null },
        { permission: 'tasks.update', scopeType: 'assigned', scopeParams: null },
        { permission: 'tasks.update', scopeType: 'own', scopeParams: null },
      ]);

      const result = await service.getPermissionsForUser('user-1', 'admin');

      expect(result).toEqual({
        'tasks.update': [{ type: 'own' }, { type: 'assigned' }],
      });
    });

    it('should collapse scopes to any when any scope is present', async () => {
      mockDb._chain.where.mockResolvedValueOnce([
        { permission: 'tasks.update', scopeType: 'own', scopeParams: null },
        { permission: 'tasks.update', scopeType: 'any', scopeParams: null },
      ]);

      const result = await service.getPermissionsForUser('user-1', 'admin');

      expect(result).toEqual({
        'tasks.update': [{ type: 'any' }],
      });
    });

    it('should return empty object when user has no permissions', async () => {
      mockDb._chain.where.mockResolvedValueOnce([]);

      const result = await service.getPermissionsForUser('user-1', 'admin');

      expect(result).toEqual({});
    });

    it('should return wildcard with any scope when role has * permission', async () => {
      mockDb._chain.where.mockResolvedValueOnce([
        { permission: '*', scopeType: 'any', scopeParams: null },
      ]);

      const result = await service.getPermissionsForUser('user-1', 'client');

      expect(result).toEqual({ '*': [{ type: 'any' }] });
    });
  });

  describe('assignRoleToUser', () => {
    it('should throw NotFoundException if role not found', async () => {
      vi.spyOn(service, 'findRoleById').mockResolvedValueOnce(null);

      await expect(service.assignRoleToUser('user-1', 'nonexistent'))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if user not found', async () => {
      const role = { id: 'role-1', name: 'admin', userType: 'admin', createdAt: new Date(), updatedAt: new Date() };
      vi.spyOn(service, 'findRoleById').mockResolvedValueOnce(role);
      mockDb._chain.limit.mockResolvedValueOnce([]);

      await expect(service.assignRoleToUser('user-1', 'role-1'))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if user type does not match role type', async () => {
      const role = { id: 'role-1', name: 'admin', userType: 'admin', createdAt: new Date(), updatedAt: new Date() };
      vi.spyOn(service, 'findRoleById').mockResolvedValueOnce(role);
      mockDb._chain.limit.mockResolvedValueOnce([{ userType: 'client' }]);

      await expect(service.assignRoleToUser('user-1', 'role-1'))
        .rejects.toThrow(ConflictException);
    });

    it('should succeed when user type matches role type', async () => {
      const role = { id: 'role-1', name: 'admin', userType: 'admin', createdAt: new Date(), updatedAt: new Date() };
      vi.spyOn(service, 'findRoleById').mockResolvedValueOnce(role);
      mockDb._chain.limit.mockResolvedValueOnce([{ userType: 'admin' }]);

      await expect(service.assignRoleToUser('user-1', 'role-1')).resolves.toBeUndefined();
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe('assignRolesInTx', () => {
    it('is a no-op when roleIds is empty', async () => {
      await service.assignRolesInTx(mockDb as any, 'user-1', [], 'admin');
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when a role does not exist', async () => {
      vi.spyOn(service, 'findRoleById').mockResolvedValueOnce(null);
      await expect(service.assignRolesInTx(mockDb as any, 'user-1', ['ghost'], 'admin'))
        .rejects.toThrow(NotFoundException);
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('throws ConflictException when role userType does not match expectedUserType', async () => {
      const role = { id: 'role-1', name: 'admin', userType: 'admin', createdAt: new Date(), updatedAt: new Date() };
      vi.spyOn(service, 'findRoleById').mockResolvedValueOnce(role);
      await expect(service.assignRolesInTx(mockDb as any, 'user-1', ['role-1'], 'client'))
        .rejects.toThrow(ConflictException);
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('inserts each role assignment when validation passes', async () => {
      const r1 = { id: 'role-1', name: 'admin', userType: 'admin', createdAt: new Date(), updatedAt: new Date() };
      const r2 = { id: 'role-2', name: 'support', userType: null, createdAt: new Date(), updatedAt: new Date() };
      vi.spyOn(service, 'findRoleById').mockResolvedValueOnce(r1).mockResolvedValueOnce(r2);
      await service.assignRolesInTx(mockDb as any, 'user-1', ['role-1', 'role-2'], 'admin');
      expect(mockDb.insert).toHaveBeenCalledTimes(2);
      expect(mockDb._chain.onConflictDoNothing).toHaveBeenCalledTimes(2);
    });
  });

  describe('unassignRolesInTx', () => {
    it('is a no-op when roleIds is empty', async () => {
      await service.unassignRolesInTx(mockDb as any, 'user-1', []);
      expect(mockDb.delete).not.toHaveBeenCalled();
    });

    it('issues a single delete with inArray when roleIds is non-empty', async () => {
      await service.unassignRolesInTx(mockDb as any, 'user-1', ['r1', 'r2']);
      expect(mockDb.delete).toHaveBeenCalledTimes(1);
    });
  });

  describe('readRoleIdsInTx', () => {
    it('returns the set of role IDs currently assigned to the user', async () => {
      mockDb._chain.where.mockResolvedValueOnce([{ roleId: 'r1' }, { roleId: 'r2' }, { roleId: 'r1' }]);
      const result = await service.readRoleIdsInTx(mockDb as any, 'user-1');
      expect(result).toEqual(new Set(['r1', 'r2']));
    });

    it('returns an empty set when the user has no roles', async () => {
      mockDb._chain.where.mockResolvedValueOnce([]);
      const result = await service.readRoleIdsInTx(mockDb as any, 'user-1');
      expect(result.size).toBe(0);
    });
  });

  describe('setRolePermissions — system role protection', () => {
    beforeEach(() => {
      seedManifests(['users.read']);
    });

    it('should block permission changes on system roles via API', async () => {
      const role = { id: 'admin-role', name: 'Admin', userType: 'client', isDefault: false, createdAt: new Date(), updatedAt: new Date() };
      vi.spyOn(service, 'findRoleById').mockResolvedValueOnce(role);
      vi.spyOn(service, 'getRolePermissions').mockResolvedValueOnce({ '*': [{ type: 'any' }] });

      await expect(
        service.setRolePermissions('admin-role', [{ name: 'users.read' }], { '*': true }),
      ).rejects.toThrow(ConflictException);
    });

    it('should allow internal permission changes on system roles (no actorPermissions)', async () => {
      const role = { id: 'admin-role', name: 'Admin', userType: 'client', isDefault: false, createdAt: new Date(), updatedAt: new Date() };
      vi.spyOn(service, 'findRoleById').mockResolvedValueOnce(role);
      vi.spyOn(service, 'getRolePermissions').mockResolvedValueOnce({ '*': [{ type: 'any' }] });
      (service as any).database.db.transaction = vi.fn().mockImplementation(async (fn: any) => fn(mockDb));

      await expect(
        service.setRolePermissions('admin-role', [{ name: '*' }]),
      ).resolves.toBeUndefined();
    });
  });

  describe('setRolePermissions — grant only what you hold', () => {
    beforeEach(() => {
      seedManifests(['users.read', 'users.manage', 'orders.read', 'anything.do']);
    });

    it('should allow setting permissions without actor check when actorPermissions not provided', async () => {
      const role = { id: 'role-1', name: 'manager', userType: 'client', isDefault: false, createdAt: new Date(), updatedAt: new Date() };
      vi.spyOn(service, 'findRoleById').mockResolvedValueOnce(role);
      vi.spyOn(service, 'getRolePermissions').mockResolvedValueOnce({});
      (service as any).database.db.transaction = vi.fn().mockImplementation(async (fn: any) => fn(mockDb));

      await expect(
        service.setRolePermissions('role-1', [{ name: 'users.read' }]),
      ).resolves.toBeUndefined();
    });

    it('should allow wildcard actor to grant any permission', async () => {
      const role = { id: 'role-1', name: 'manager', userType: 'client', isDefault: false, createdAt: new Date(), updatedAt: new Date() };
      vi.spyOn(service, 'findRoleById').mockResolvedValueOnce(role);
      vi.spyOn(service, 'getRolePermissions').mockResolvedValueOnce({});
      (service as any).database.db.transaction = vi.fn().mockImplementation(async (fn: any) => fn(mockDb));

      await expect(
        service.setRolePermissions('role-1', [{ name: 'anything.do' }], { '*': true }),
      ).resolves.toBeUndefined();
    });

    it('should reject granting permissions the actor does not hold', async () => {
      const role = { id: 'role-1', name: 'staff', userType: 'client', isDefault: false, createdAt: new Date(), updatedAt: new Date() };
      vi.spyOn(service, 'findRoleById').mockResolvedValueOnce(role);
      vi.spyOn(service, 'getRolePermissions').mockResolvedValueOnce({});

      const actorPermissions = { 'orders.read': [{ type: 'any' }], 'orders.write': [{ type: 'any' }] };

      await expect(
        service.setRolePermissions('role-1', [{ name: 'users.manage' }], actorPermissions),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow granting permissions the actor holds', async () => {
      const role = { id: 'role-1', name: 'staff', userType: 'client', isDefault: false, createdAt: new Date(), updatedAt: new Date() };
      vi.spyOn(service, 'findRoleById').mockResolvedValueOnce(role);
      vi.spyOn(service, 'getRolePermissions').mockResolvedValueOnce({});
      (service as any).database.db.transaction = vi.fn().mockImplementation(async (fn: any) => fn(mockDb));

      const actorPermissions = { 'orders.read': [{ type: 'any' }], 'orders.write': [{ type: 'any' }] };

      await expect(
        service.setRolePermissions('role-1', [{ name: 'orders.read' }], actorPermissions),
      ).resolves.toBeUndefined();
    });

    it('should reject removing permissions the actor does not hold', async () => {
      const role = { id: 'role-1', name: 'staff', userType: 'client', isDefault: false, createdAt: new Date(), updatedAt: new Date() };
      vi.spyOn(service, 'findRoleById').mockResolvedValueOnce(role);
      // Role currently has users.manage — actor does not hold it
      vi.spyOn(service, 'getRolePermissions').mockResolvedValueOnce({
        'orders.read': [{ type: 'any' }],
        'users.manage': [{ type: 'any' }],
      });

      const actorPermissions = { 'orders.read': [{ type: 'any' }] };

      // Actor tries to set only orders.read — removing users.manage which they don't hold
      await expect(
        service.setRolePermissions('role-1', [{ name: 'orders.read' }], actorPermissions),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('setRolePermissions — lockout prevention', () => {
    beforeEach(() => {
      seedManifests(['users.read']);
    });

    it('should block removing * when no other wildcard users exist', async () => {
      const role = { id: 'role-1', name: 'admin', userType: 'client', isDefault: false, createdAt: new Date(), updatedAt: new Date() };
      vi.spyOn(service, 'findRoleById').mockResolvedValueOnce(role);
      // Role currently has wildcard
      vi.spyOn(service, 'getRolePermissions').mockResolvedValueOnce({ '*': [{ type: 'any' }] });
      // No other wildcard users exist
      vi.spyOn(service, 'countWildcardUsers').mockResolvedValueOnce(0);

      await expect(
        service.setRolePermissions('role-1', [{ name: 'users.read' }]),
      ).rejects.toThrow(ConflictException);
    });

    it('should allow removing * when other wildcard users exist', async () => {
      const role = { id: 'role-1', name: 'admin', userType: 'client', isDefault: false, createdAt: new Date(), updatedAt: new Date() };
      vi.spyOn(service, 'findRoleById').mockResolvedValueOnce(role);
      vi.spyOn(service, 'getRolePermissions').mockResolvedValueOnce({ '*': [{ type: 'any' }] });
      // Other wildcard users exist
      vi.spyOn(service, 'countWildcardUsers').mockResolvedValueOnce(2);
      (service as any).database.db.transaction = vi.fn().mockImplementation(async (fn: any) => fn(mockDb));

      await expect(
        service.setRolePermissions('role-1', [{ name: 'users.read' }]),
      ).resolves.toBeUndefined();
    });

    it('should allow keeping * permission without lockout check', async () => {
      const role = { id: 'role-1', name: 'admin', userType: 'client', isDefault: false, createdAt: new Date(), updatedAt: new Date() };
      vi.spyOn(service, 'findRoleById').mockResolvedValueOnce(role);
      vi.spyOn(service, 'getRolePermissions').mockResolvedValueOnce({ '*': [{ type: 'any' }] });
      (service as any).database.db.transaction = vi.fn().mockImplementation(async (fn: any) => fn(mockDb));

      // Keeping wildcard — no lockout check needed
      await expect(
        service.setRolePermissions('role-1', [{ name: '*' }]),
      ).resolves.toBeUndefined();
    });
  });

  describe('registerManifests', () => {
    it('registers manifests into the registry so they are visible to validation + discovery', () => {
      service.registerManifests([
        { slug: 'candidates.create', module: 'candidates', action: 'create', label: 'Create candidates', description: 'Create candidates', supportedScopes: ['any'] },
        { slug: 'candidates.read',   module: 'candidates', action: 'read',   label: 'View candidates',   description: 'View candidates',   supportedScopes: ['any'] },
      ]);

      expect(manifestRegistry.list()).toHaveLength(2);
      expect(manifestRegistry.get('candidates.create')).toMatchObject({
        module: 'candidates',
        action: 'create',
        label: 'Create candidates',
      });
    });
  });

  describe('setRolePermissions — manifest scope validation', () => {
    const role = {
      id: 'role-1',
      name: 'preparer',
      userType: null,
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      (service as any).database.db.transaction = vi.fn().mockImplementation(async (fn: any) => fn(mockDb));
      vi.spyOn(service, 'findRoleById').mockResolvedValue(role);
      vi.spyOn(service, 'getRolePermissions').mockResolvedValue({});
    });

    it('allows scopes that are in the manifest supportedScopes', async () => {
      service.registerManifests([
        {
          slug: 'filings.pickup',
          module: 'filings',
          action: 'pickup',
          label: 'Pick up filing',
          supportedScopes: ['unit', 'unassigned_in_unit'],
        },
      ]);

      await expect(
        service.setRolePermissions('role-1', [
          { name: 'filings.pickup', scopes: [{ type: 'unit' }] },
        ]),
      ).resolves.toBeUndefined();
    });

    it('rejects a scope type not in supportedScopes', async () => {
      service.registerManifests([
        {
          slug: 'filings.pickup',
          module: 'filings',
          action: 'pickup',
          label: 'Pick up filing',
          supportedScopes: ['unit', 'unassigned_in_unit'],
        },
      ]);

      await expect(
        service.setRolePermissions('role-1', [
          { name: 'filings.pickup', scopes: [{ type: 'own' }] },
        ]),
      ).rejects.toThrow(ConflictException);
    });

    it("rejects 'any' when the manifest doesn't list it", async () => {
      service.registerManifests([
        {
          slug: 'filings.pickup',
          module: 'filings',
          action: 'pickup',
          label: 'Pick up filing',
          supportedScopes: ['unit'],
        },
      ]);

      await expect(
        service.setRolePermissions('role-1', ['filings.pickup']), // string form → scope 'any'
      ).rejects.toThrow(ConflictException);
    });

    it('rejects slugs that have no registered manifest', async () => {
      await expect(
        service.setRolePermissions('role-1', [
          { name: 'not-yet-registered.read', scopes: [{ type: 'own' }] },
        ]),
      ).rejects.toThrow(/unknown permission/);
    });

    it("allows wildcard '*' regardless of manifest state", async () => {
      await expect(
        service.setRolePermissions('role-1', [{ name: '*' }]),
      ).resolves.toBeUndefined();
    });
  });

  describe('getRolesByUserIds (batch)', () => {
    it('should return an empty map for empty input (no DB call)', async () => {
      const result = await service.getRolesByUserIds([]);
      expect(result).toEqual({});
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it('should return an entry for every input id, empty array when no roles', async () => {
      mockDb._chain.where.mockResolvedValueOnce([]);

      const result = await service.getRolesByUserIds(['u1', 'u2']);

      expect(result).toEqual({ u1: [], u2: [] });
      expect(mockDb.select).toHaveBeenCalledOnce();
    });

    it('should group roles under the owning userId', async () => {
      const roleA = { id: 'r1', name: 'Admin', userType: 'admin', isDefault: false, createdAt: new Date(), updatedAt: new Date() };
      const roleB = { id: 'r2', name: 'Editor', userType: 'admin', isDefault: false, createdAt: new Date(), updatedAt: new Date() };
      mockDb._chain.where.mockResolvedValueOnce([
        { userId: 'u1', ...roleA },
        { userId: 'u1', ...roleB },
        { userId: 'u2', ...roleA },
      ]);

      const result = await service.getRolesByUserIds(['u1', 'u2', 'u3']);

      expect(result.u1?.map((r: { name: string }) => r.name).sort()).toEqual(['Admin', 'Editor']);
      expect(result.u2?.map((r: { name: string }) => r.name)).toEqual(['Admin']);
      expect(result.u3).toEqual([]);
    });
  });
});
