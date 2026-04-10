import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { randomUUID } from 'crypto';
import { createIntegrationTestModule, cleanDatabase } from '@packages/testing';
import { EventsModule } from '@packages/events';
import { DatabaseService, users } from '@packages/database';
import { RbacModule } from '../../rbac.module';
import { RbacService } from '../rbac.service';
import { PermissionRegistryService } from '../permission-registry.service';
import type { DrizzleDB } from '@packages/database';
import type { TestingModule } from '@nestjs/testing';

describe('RBAC (integration)', () => {
  let module: TestingModule;
  let db: DrizzleDB;
  let cleanup: () => Promise<void>;
  let rbacService: RbacService;
  let permissionRegistry: PermissionRegistryService;

  beforeAll(async () => {
    const ctx = await createIntegrationTestModule({
      imports: [EventsModule, RbacModule],
    });
    module = ctx.module;
    db = ctx.db;
    cleanup = ctx.cleanup;
    rbacService = module.get(RbacService);
    permissionRegistry = module.get(PermissionRegistryService);
  });

  afterEach(async () => {
    await cleanDatabase(db);
  });

  afterAll(async () => {
    await cleanup();
  });

  async function createUser(userType = 'admin') {
    const [user] = await db
      .insert(users)
      .values({ email: `${randomUUID()}@example.com`, firstName: 'Test', lastName: 'User', userType })
      .returning();
    return user;
  }

  describe('Role CRUD', () => {
    it('should create a role', async () => {
      const role = await rbacService.createRole({ name: 'Editor', userType: 'admin' });
      expect(role.id).toBeDefined();
      expect(role.name).toBe('Editor');
      expect(role.userType).toBe('admin');
    });

    it('should find a role by ID', async () => {
      const created = await rbacService.createRole({ name: 'Viewer', userType: 'admin' });
      const found = await rbacService.findRoleById(created.id);
      expect(found).not.toBeNull();
      expect(found!.name).toBe('Viewer');
    });

    it('should update a role name', async () => {
      const role = await rbacService.createRole({ name: 'Old Name', userType: 'admin' });
      const updated = await rbacService.updateRole(role.id, { name: 'New Name' });
      expect(updated.name).toBe('New Name');
    });

    it('should delete a role with no users', async () => {
      const role = await rbacService.createRole({ name: 'Temp', userType: 'admin' });
      await rbacService.deleteRole(role.id);
      const found = await rbacService.findRoleById(role.id);
      expect(found).toBeNull();
    });

    it('should prevent deleting a role assigned to users', async () => {
      const role = await rbacService.createRole({ name: 'InUse', userType: 'admin' });
      const user = await createUser('admin');
      await rbacService.assignRoleToUser(user.id, role.id);

      await expect(rbacService.deleteRole(role.id)).rejects.toThrow('Cannot delete a role that is assigned to users');
    });

    it('should prevent deleting a default role', async () => {
      const role = await rbacService.createRole({ name: 'Default', userType: 'admin', isDefault: true });
      await expect(rbacService.deleteRole(role.id)).rejects.toThrow('Cannot delete a default role');
    });

    it('should list roles with pagination', async () => {
      for (let i = 0; i < 5; i++) {
        await rbacService.createRole({ name: `Role ${i}`, userType: 'admin' });
      }

      const page1 = await rbacService.listRoles({ page: 1, limit: 3 });
      expect(page1.data).toHaveLength(3);
      expect(page1.meta.total).toBe(5);

      const page2 = await rbacService.listRoles({ page: 2, limit: 3 });
      expect(page2.data).toHaveLength(2);
    });

    it('should filter roles by userType', async () => {
      await rbacService.createRole({ name: 'Admin Role', userType: 'admin' });
      await rbacService.createRole({ name: 'Client Role', userType: 'client' });

      const adminRoles = await rbacService.findRolesByUserType('admin');
      expect(adminRoles.every((r) => r.userType === 'admin')).toBe(true);
    });

    it('should find default role for user type', async () => {
      await rbacService.createRole({ name: 'Regular', userType: 'admin' });
      await rbacService.createRole({ name: 'Default Admin', userType: 'admin', isDefault: true });

      const defaultRole = await rbacService.findDefaultRoleForUserType('admin');
      expect(defaultRole).not.toBeNull();
      expect(defaultRole!.name).toBe('Default Admin');
    });
  });

  describe('Permissions', () => {
    it('should set and get role permissions', async () => {
      const role = await rbacService.createRole({ name: 'Editor', userType: 'admin' });
      await rbacService.setRolePermissions(role.id, ['users.read', 'users.update']);

      const perms = await rbacService.getRolePermissions(role.id);
      expect(perms).toEqual({ 'users.read': true, 'users.update': true });
    });

    it('should replace permissions on update', async () => {
      const role = await rbacService.createRole({ name: 'Editor', userType: 'admin' });
      await rbacService.setRolePermissions(role.id, ['users.read', 'users.update']);
      await rbacService.setRolePermissions(role.id, ['users.read']);

      const perms = await rbacService.getRolePermissions(role.id);
      expect(perms).toEqual({ 'users.read': true });
    });

    it('should resolve user permissions through role chain', async () => {
      const user = await createUser('admin');
      const role = await rbacService.createRole({ name: 'Manager', userType: 'admin' });
      await rbacService.setRolePermissions(role.id, ['users.read', 'users.create']);
      await rbacService.assignRoleToUser(user.id, role.id);

      const perms = await rbacService.getPermissionsForUser(user.id, 'admin');
      expect(perms['users.read']).toBe(true);
      expect(perms['users.create']).toBe(true);
    });

    it('should aggregate permissions from multiple roles', async () => {
      const user = await createUser('admin');
      const role1 = await rbacService.createRole({ name: 'Viewer', userType: 'admin' });
      const role2 = await rbacService.createRole({ name: 'Editor', userType: 'admin' });
      await rbacService.setRolePermissions(role1.id, ['users.read']);
      await rbacService.setRolePermissions(role2.id, ['users.update']);
      await rbacService.assignRoleToUser(user.id, role1.id);
      await rbacService.assignRoleToUser(user.id, role2.id);

      const perms = await rbacService.getPermissionsForUser(user.id, 'admin');
      expect(perms['users.read']).toBe(true);
      expect(perms['users.update']).toBe(true);
    });
  });

  describe('User-role assignment', () => {
    it('should assign and retrieve user roles', async () => {
      const user = await createUser('admin');
      const role = await rbacService.createRole({ name: 'Member', userType: 'admin' });
      await rbacService.assignRoleToUser(user.id, role.id);

      const userRolesList = await rbacService.getUserRoles(user.id);
      expect(userRolesList).toHaveLength(1);
      expect(userRolesList[0].name).toBe('Member');
    });

    it('should prevent assigning role with mismatched userType', async () => {
      const user = await createUser('admin');
      const role = await rbacService.createRole({ name: 'Client Only', userType: 'client' });

      await expect(rbacService.assignRoleToUser(user.id, role.id)).rejects.toThrow(
        "Cannot assign role scoped to 'client'",
      );
    });

    it('should remove role from user', async () => {
      const user = await createUser('admin');
      const role = await rbacService.createRole({ name: 'Temp Role', userType: 'admin' });
      await rbacService.assignRoleToUser(user.id, role.id);
      await rbacService.removeRoleFromUser(user.id, role.id);

      const userRolesList = await rbacService.getUserRoles(user.id);
      expect(userRolesList).toHaveLength(0);
    });

    it('should handle duplicate assignment gracefully', async () => {
      const user = await createUser('admin');
      const role = await rbacService.createRole({ name: 'Dup', userType: 'admin' });
      await rbacService.assignRoleToUser(user.id, role.id);
      await rbacService.assignRoleToUser(user.id, role.id); // should not throw

      const userRolesList = await rbacService.getUserRoles(user.id);
      expect(userRolesList).toHaveLength(1);
    });

    it('should count users for a role', async () => {
      const role = await rbacService.createRole({ name: 'Counted', userType: 'admin' });
      const user1 = await createUser('admin');
      const user2 = await createUser('admin');
      await rbacService.assignRoleToUser(user1.id, role.id);
      await rbacService.assignRoleToUser(user2.id, role.id);

      const count = await rbacService.getRoleUserCount(role.id);
      expect(count).toBe(2);
    });
  });

  describe('System role protection', () => {
    it('should prevent modifying system role (wildcard) permissions', async () => {
      const role = await rbacService.createRole({ name: 'Super Admin', userType: 'admin' });
      await rbacService.setRolePermissions(role.id, ['*']);

      await expect(
        rbacService.setRolePermissions(role.id, ['users.read'], { '*': true }),
      ).rejects.toThrow('Cannot modify permissions of the system admin role');
    });

    it('should prevent updating system role name', async () => {
      const role = await rbacService.createRole({ name: 'System', userType: 'admin' });
      await rbacService.setRolePermissions(role.id, ['*']);

      await expect(rbacService.updateRole(role.id, { name: 'Changed' })).rejects.toThrow(
        'Cannot modify the system admin role',
      );
    });
  });

  describe('Permission registry', () => {
    it('should register and retrieve permissions from modules', () => {
      rbacService.registerPermissions('test_module', [
        { action: 'read', description: 'Read test resources' },
        { action: 'create', description: 'Create test resources' },
      ]);

      const all = rbacService.getAllRegisteredPermissions();
      const testPerms = all.filter((p) => p.module === 'test_module');
      expect(testPerms).toHaveLength(2);
      expect(testPerms.map((p) => p.action)).toContain('read');
    });
  });
});
