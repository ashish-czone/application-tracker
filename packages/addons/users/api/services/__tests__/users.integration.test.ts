import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { Global, Module } from '@nestjs/common';
import { createIntegrationTestModule, cleanDatabase } from '@packages/testing';
import { EventsModule } from '@packages/events';
import { RbacModule, RbacService } from '@packages/rbac';
import { SettingsModule } from '@packages/settings';
import { AuditModule } from '@packages/audit';
import { AuthModule } from '@packages/auth';
import { ContactResolverRegistry } from '@packages/notifications/services/contact-resolver-registry';
import { LookupResolverService } from '@packages/entity-engine/services/lookup-resolver.service';
import { EntityEngineModule } from '@packages/entity-engine';
import { UsersService } from '../users.service';
import { USERS_CONFIG } from '../../users.config';
import type { DrizzleDB } from '@packages/database';
import type { TestingModule } from '@nestjs/testing';

@Global()
@Module({
  providers: [
    ContactResolverRegistry,
    { provide: LookupResolverService, useValue: { register: () => {} } },
  ],
  exports: [ContactResolverRegistry, LookupResolverService],
})
class MockDepsModule {}

/**
 * Test-only users module. Registers the static USERS_CONFIG with the
 * entity-engine; UsersService owns the full write path so no per-handler
 * wiring is needed.
 */
@Module({
  imports: [EntityEngineModule.forEntity(USERS_CONFIG)],
  providers: [UsersService],
  exports: [UsersService],
})
class TestUsersModule {}

describe('Users (integration)', () => {
  let module: TestingModule;
  let db: DrizzleDB;
  let cleanup: () => Promise<void>;
  let usersService: UsersService;
  let rbacService: RbacService;

  beforeAll(async () => {
    const ctx = await createIntegrationTestModule({
      imports: [
        EventsModule,
        RbacModule,
        SettingsModule,
        AuditModule,
        AuthModule.register({ jwtSecret: 'test-secret-key-users' }),
        MockDepsModule,
        TestUsersModule,
      ],
    });
    module = ctx.module;
    db = ctx.db;
    cleanup = ctx.cleanup;
    usersService = module.get(UsersService);
    rbacService = module.get(RbacService);
  });

  afterEach(async () => {
    await cleanDatabase(db);
  });

  afterAll(async () => {
    await cleanup();
  });

  async function createRole(userType = 'admin') {
    const role = await rbacService.createRole({ name: `role-${Date.now()}`, userType });
    await rbacService.setRolePermissions(role.id, ['users.read']);
    return role;
  }

  describe('User CRUD', () => {
    it('should create a user with credentials and roles', async () => {
      const role = await createRole();
      const user = await usersService.create(
        {
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          userType: 'admin',
          credentials: { password: 'SecurePass1!' },
          roles: [role.id],
        },
        'system',
      );

      expect(user.id).toBeDefined();
      expect(user.email).toBe('test@example.com');
      expect(user.firstName).toBe('John');

      // Verify role assignment via RBAC service
      const assignedRoles = await rbacService.getRolesByUserIds([user.id as string]);
      expect(assignedRoles[user.id as string] ?? []).toHaveLength(1);
    });

    it('should list users with pagination', async () => {
      const role = await createRole();
      for (let i = 0; i < 5; i++) {
        await usersService.create(
          {
            email: `user${i}@example.com`,
            firstName: `User${i}`,
            lastName: 'Test',
            userType: 'admin',
            credentials: { password: 'Pass1234!' },
            roles: [role.id],
          },
          'system',
        );
      }

      const page = await usersService.list({ page: 1, limit: 3 } as never);
      expect(page.data).toHaveLength(3);
      expect(page.meta.total).toBe(5);
    });

    it('should find a user by ID', async () => {
      const role = await createRole();
      const created = await usersService.create(
        {
          email: 'find-me@example.com',
          firstName: 'Find',
          lastName: 'Me',
          userType: 'admin',
          credentials: { password: 'Pass1234!' },
          roles: [role.id],
        },
        'system',
      );

      const found = await usersService.findOne(created.id as string);
      expect(found.email).toBe('find-me@example.com');
    });

    it('should update a user (standard fields)', async () => {
      const role = await createRole();
      const user = await usersService.create(
        {
          email: 'update@example.com',
          firstName: 'Old',
          lastName: 'Name',
          userType: 'admin',
          credentials: { password: 'Pass1234!' },
          roles: [role.id],
        },
        'system',
      );

      const updated = await usersService.update(user.id as string, { firstName: 'New' }, 'system');
      expect(updated.firstName).toBe('New');
    });

    it('should soft-delete and restore a user', async () => {
      const role = await createRole();
      const user = await usersService.create(
        {
          email: 'delete@example.com',
          firstName: 'Delete',
          lastName: 'Me',
          userType: 'admin',
          credentials: { password: 'Pass1234!' },
          roles: [role.id],
        },
        'system',
      );

      await usersService.softDelete(user.id as string, 'system');

      // Should not appear in default listing
      const list = await usersService.list({} as never);
      expect(list.data.find((u) => u.id === user.id)).toBeUndefined();

      // Restore
      const restored = await usersService.restore(user.id as string);
      expect(restored.deletedAt).toBeNull();
    });
  });

  describe('User helpers', () => {
    it('should get email by user ID', async () => {
      const role = await createRole();
      const user = await usersService.create(
        {
          email: 'helper@example.com',
          firstName: 'Helper',
          lastName: 'Test',
          userType: 'admin',
          credentials: { password: 'Pass1234!' },
          roles: [role.id],
        },
        'system',
      );

      const email = await usersService.getEmail(user.id as string);
      expect(email).toBe('helper@example.com');
    });
  });
});
