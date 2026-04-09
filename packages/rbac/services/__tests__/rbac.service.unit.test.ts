import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { RbacService } from '../rbac.service';
import { PermissionRegistryService } from '../permission-registry.service';

// Mock database helpers
function createMockDb() {
  const mockChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
  };

  return {
    select: vi.fn().mockReturnValue(mockChain),
    insert: vi.fn().mockReturnValue(mockChain),
    update: vi.fn().mockReturnValue(mockChain),
    delete: vi.fn().mockReturnValue(mockChain),
    _chain: mockChain,
  };
}

function createMockDatabaseService(mockDb: ReturnType<typeof createMockDb>) {
  return { db: mockDb } as any;
}

describe('RbacService', () => {
  let service: RbacService;
  let permissionRegistry: PermissionRegistryService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    const databaseService = createMockDatabaseService(mockDb);
    permissionRegistry = new PermissionRegistryService();
    service = new RbacService(databaseService, permissionRegistry);
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
    it('should delete the role when no users assigned', async () => {
      const role = { id: 'role-1', name: 'custom', userType: 'admin', isDefault: false, createdAt: new Date(), updatedAt: new Date() };
      vi.spyOn(service, 'findRoleById').mockResolvedValueOnce(role);
      vi.spyOn(service, 'isSystemRole').mockResolvedValueOnce(false);
      // Mock count query — no users assigned
      mockDb._chain.where.mockResolvedValueOnce([{ total: 0 }]);

      await expect(service.deleteRole('role-1')).resolves.toBeUndefined();
      expect(mockDb.delete).toHaveBeenCalled();
    });

    it('should throw NotFoundException if role not found', async () => {
      vi.spyOn(service, 'findRoleById').mockResolvedValueOnce(null);

      await expect(service.deleteRole('nonexistent'))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when deleting a system role', async () => {
      const role = { id: 'admin-role', name: 'Admin', userType: 'client', isDefault: false, createdAt: new Date(), updatedAt: new Date() };
      vi.spyOn(service, 'findRoleById').mockResolvedValueOnce(role);
      vi.spyOn(service, 'isSystemRole').mockResolvedValueOnce(true);

      await expect(service.deleteRole('admin-role'))
        .rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when deleting a default role', async () => {
      const role = { id: 'role-1', name: 'client', userType: 'client', isDefault: true, createdAt: new Date(), updatedAt: new Date() };
      vi.spyOn(service, 'findRoleById').mockResolvedValueOnce(role);
      vi.spyOn(service, 'isSystemRole').mockResolvedValueOnce(false);

      await expect(service.deleteRole('role-1'))
        .rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when role has assigned users', async () => {
      const role = { id: 'role-1', name: 'custom', userType: 'admin', isDefault: false, createdAt: new Date(), updatedAt: new Date() };
      vi.spyOn(service, 'findRoleById').mockResolvedValueOnce(role);
      vi.spyOn(service, 'isSystemRole').mockResolvedValueOnce(false);
      // Mock count query — 3 users assigned
      mockDb._chain.where.mockResolvedValueOnce([{ total: 3 }]);

      await expect(service.deleteRole('role-1'))
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
    it('should return boolean permissions as Record<string, true>', async () => {
      mockDb._chain.where.mockResolvedValueOnce([
        { permission: 'users.read' },
        { permission: 'users.update' },
      ]);

      const result = await service.getPermissionsForUser('user-1', 'admin');

      expect(result).toEqual({
        'users.read': true,
        'users.update': true,
      });
    });

    it('should deduplicate permissions from multiple roles', async () => {
      mockDb._chain.where.mockResolvedValueOnce([
        { permission: 'users.read' },
        { permission: 'users.read' },
        { permission: 'users.update' },
      ]);

      const result = await service.getPermissionsForUser('user-1', 'admin');

      expect(result).toEqual({
        'users.read': true,
        'users.update': true,
      });
    });

    it('should return empty object when user has no permissions', async () => {
      mockDb._chain.where.mockResolvedValueOnce([]);

      const result = await service.getPermissionsForUser('user-1', 'admin');

      expect(result).toEqual({});
    });

    it('should return wildcard when role has * permission', async () => {
      mockDb._chain.where.mockResolvedValueOnce([
        { permission: '*' },
      ]);

      const result = await service.getPermissionsForUser('user-1', 'client');

      expect(result).toEqual({ '*': true });
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

  describe('setRolePermissions — system role protection', () => {
    it('should block permission changes on system roles via API', async () => {
      const role = { id: 'admin-role', name: 'Admin', userType: 'client', isDefault: false, createdAt: new Date(), updatedAt: new Date() };
      vi.spyOn(service, 'findRoleById').mockResolvedValueOnce(role);
      vi.spyOn(service, 'getRolePermissions').mockResolvedValueOnce({ '*': 'all' });

      await expect(
        service.setRolePermissions('admin-role', [{ name: 'users.read' }], { '*': 'all' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should allow internal permission changes on system roles (no actorPermissions)', async () => {
      const role = { id: 'admin-role', name: 'Admin', userType: 'client', isDefault: false, createdAt: new Date(), updatedAt: new Date() };
      vi.spyOn(service, 'findRoleById').mockResolvedValueOnce(role);
      vi.spyOn(service, 'getRolePermissions').mockResolvedValueOnce({ '*': 'all' });
      (service as any).database.db.transaction = vi.fn().mockImplementation(async (fn: any) => fn(mockDb));

      await expect(
        service.setRolePermissions('admin-role', [{ name: '*' }]),
      ).resolves.toBeUndefined();
    });
  });

  describe('setRolePermissions — grant only what you hold', () => {
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
        service.setRolePermissions('role-1', [{ name: 'anything.do' }], { '*': 'all' }),
      ).resolves.toBeUndefined();
    });

    it('should reject granting permissions the actor does not hold', async () => {
      const role = { id: 'role-1', name: 'staff', userType: 'client', isDefault: false, createdAt: new Date(), updatedAt: new Date() };
      vi.spyOn(service, 'findRoleById').mockResolvedValueOnce(role);
      vi.spyOn(service, 'getRolePermissions').mockResolvedValueOnce({});

      const actorPermissions = { 'orders.read': 'all' as const, 'orders.write': 'all' as const };

      await expect(
        service.setRolePermissions('role-1', [{ name: 'users.manage' }], actorPermissions),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow granting permissions the actor holds', async () => {
      const role = { id: 'role-1', name: 'staff', userType: 'client', isDefault: false, createdAt: new Date(), updatedAt: new Date() };
      vi.spyOn(service, 'findRoleById').mockResolvedValueOnce(role);
      vi.spyOn(service, 'getRolePermissions').mockResolvedValueOnce({});
      (service as any).database.db.transaction = vi.fn().mockImplementation(async (fn: any) => fn(mockDb));

      const actorPermissions = { 'orders.read': 'all' as const, 'orders.write': 'all' as const };

      await expect(
        service.setRolePermissions('role-1', [{ name: 'orders.read' }], actorPermissions),
      ).resolves.toBeUndefined();
    });

    it('should reject removing permissions the actor does not hold', async () => {
      const role = { id: 'role-1', name: 'staff', userType: 'client', isDefault: false, createdAt: new Date(), updatedAt: new Date() };
      vi.spyOn(service, 'findRoleById').mockResolvedValueOnce(role);
      // Role currently has users.manage — actor does not hold it
      vi.spyOn(service, 'getRolePermissions').mockResolvedValueOnce({
        'orders.read': 'all',
        'users.manage': 'all',
      });

      const actorPermissions = { 'orders.read': 'all' as const };

      // Actor tries to set only orders.read — removing users.manage which they don't hold
      await expect(
        service.setRolePermissions('role-1', [{ name: 'orders.read' }], actorPermissions),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('setRolePermissions — lockout prevention', () => {
    it('should block removing * when no other wildcard users exist', async () => {
      const role = { id: 'role-1', name: 'admin', userType: 'client', isDefault: false, createdAt: new Date(), updatedAt: new Date() };
      vi.spyOn(service, 'findRoleById').mockResolvedValueOnce(role);
      // Role currently has wildcard
      vi.spyOn(service, 'getRolePermissions').mockResolvedValueOnce({ '*': 'all' });
      // No other wildcard users exist
      vi.spyOn(service, 'countWildcardUsers').mockResolvedValueOnce(0);

      await expect(
        service.setRolePermissions('role-1', [{ name: 'users.read' }]),
      ).rejects.toThrow(ConflictException);
    });

    it('should allow removing * when other wildcard users exist', async () => {
      const role = { id: 'role-1', name: 'admin', userType: 'client', isDefault: false, createdAt: new Date(), updatedAt: new Date() };
      vi.spyOn(service, 'findRoleById').mockResolvedValueOnce(role);
      vi.spyOn(service, 'getRolePermissions').mockResolvedValueOnce({ '*': 'all' });
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
      vi.spyOn(service, 'getRolePermissions').mockResolvedValueOnce({ '*': 'all' });
      (service as any).database.db.transaction = vi.fn().mockImplementation(async (fn: any) => fn(mockDb));

      // Keeping wildcard — no lockout check needed
      await expect(
        service.setRolePermissions('role-1', [{ name: '*' }]),
      ).resolves.toBeUndefined();
    });
  });

  describe('registerPermissions / getAllRegisteredPermissions', () => {
    it('should delegate to permission registry', () => {
      service.registerPermissions('candidates', [
        { action: 'create', description: 'Create candidates' },
        { action: 'read', description: 'View candidates' },
      ]);

      const result = service.getAllRegisteredPermissions();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        module: 'candidates',
        action: 'create',
        description: 'Create candidates',
      });
    });
  });
});
