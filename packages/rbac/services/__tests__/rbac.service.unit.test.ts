import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, ConflictException } from '@nestjs/common';
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
      const role = { id: 'role-1', name: 'admin', userType: 'admin', createdAt: new Date(), updatedAt: new Date() };
      mockDb._chain.returning.mockResolvedValueOnce([role]);

      const result = await service.createRole({ name: 'admin', userType: 'admin' });

      expect(result).toEqual(role);
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe('updateRole', () => {
    it('should update and return the role', async () => {
      const role = { id: 'role-1', name: 'updated', userType: 'admin', createdAt: new Date(), updatedAt: new Date() };
      mockDb._chain.returning.mockResolvedValueOnce([role]);

      const result = await service.updateRole('role-1', { name: 'updated' });

      expect(result.name).toBe('updated');
    });

    it('should throw NotFoundException if role not found', async () => {
      mockDb._chain.returning.mockResolvedValueOnce([]);

      await expect(service.updateRole('nonexistent', { name: 'x' }))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteRole', () => {
    it('should delete the role', async () => {
      const role = { id: 'role-1' };
      mockDb._chain.returning.mockResolvedValueOnce([role]);

      await expect(service.deleteRole('role-1')).resolves.toBeUndefined();
    });

    it('should throw NotFoundException if role not found', async () => {
      mockDb._chain.returning.mockResolvedValueOnce([]);

      await expect(service.deleteRole('nonexistent'))
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

  describe('assignRoleToUser', () => {
    it('should throw NotFoundException if role not found', async () => {
      vi.spyOn(service, 'findRoleById').mockResolvedValueOnce(null);

      await expect(service.assignRoleToUser('user-1', 'nonexistent'))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if user lacks the role user type', async () => {
      const role = { id: 'role-1', name: 'admin', userType: 'admin', createdAt: new Date(), updatedAt: new Date() };
      vi.spyOn(service, 'findRoleById').mockResolvedValueOnce(role);
      vi.spyOn(service, 'getUserTypes').mockResolvedValueOnce(['client']);

      await expect(service.assignRoleToUser('user-1', 'role-1'))
        .rejects.toThrow(ConflictException);
    });

    it('should succeed when user has the matching user type', async () => {
      const role = { id: 'role-1', name: 'admin', userType: 'admin', createdAt: new Date(), updatedAt: new Date() };
      vi.spyOn(service, 'findRoleById').mockResolvedValueOnce(role);
      vi.spyOn(service, 'getUserTypes').mockResolvedValueOnce(['admin']);

      await expect(service.assignRoleToUser('user-1', 'role-1')).resolves.toBeUndefined();
      expect(mockDb.insert).toHaveBeenCalled();
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
