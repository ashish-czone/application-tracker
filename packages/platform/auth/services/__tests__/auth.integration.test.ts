import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { randomUUID } from 'crypto';
import { createIntegrationTestModule, cleanDatabase } from '@packages/testing';
import { EventsModule } from '@packages/events';
import { RbacModule } from '@packages/rbac';
import { SettingsModule } from '@packages/settings';
import { AuditModule } from '@packages/audit';
import { DatabaseService, users } from '@packages/database';
import { AuthModule } from '../../auth.module';
import { AuthService } from '../auth.service';
import type { DrizzleDB } from '@packages/database';
import type { TestingModule } from '@nestjs/testing';

describe('Auth (integration)', () => {
  let module: TestingModule;
  let db: DrizzleDB;
  let cleanup: () => Promise<void>;
  let authService: AuthService;

  beforeAll(async () => {
    const ctx = await createIntegrationTestModule({
      imports: [
        EventsModule,
        RbacModule,
        SettingsModule,
        AuditModule,
        AuthModule.register({ jwtSecret: 'test-secret-key-for-integration-tests' }),
      ],
    });
    module = ctx.module;
    db = ctx.db;
    cleanup = ctx.cleanup;
    authService = module.get(AuthService);
  });

  afterEach(async () => {
    await cleanDatabase(db);
  });

  afterAll(async () => {
    await cleanup();
  });

  async function createUser(email?: string) {
    const e = email ?? `${randomUUID()}@example.com`;
    const [user] = await db
      .insert(users)
      .values({ email: e, firstName: 'Test', lastName: 'User', userType: 'admin' })
      .returning();
    return user;
  }

  describe('Password credentials', () => {
    it('should create and verify a password credential', async () => {
      const user = await createUser();
      await authService.createPasswordCredential(user.id, user.email, 'SecurePass1!');

      const result = await authService.verifyPasswordCredential(user.email, 'SecurePass1!');
      expect(result.userId).toBe(user.id);
    });

    it('should reject incorrect password', async () => {
      const user = await createUser();
      await authService.createPasswordCredential(user.id, user.email, 'SecurePass1!');

      await expect(
        authService.verifyPasswordCredential(user.email, 'WrongPassword'),
      ).rejects.toThrow();
    });

    it('should reject non-existent identifier', async () => {
      await expect(
        authService.verifyPasswordCredential('nonexistent@example.com', 'pass'),
      ).rejects.toThrow();
    });
  });

  describe('Access tokens', () => {
    it('should generate and verify an access token', () => {
      const payload = {
        userId: randomUUID(),
        userType: 'admin',
        permissions: { 'users.read': true },
      };

      const token = authService.generateAccessToken(payload);
      expect(typeof token).toBe('string');

      const verified = authService.verifyAccessToken(token);
      expect(verified.userId).toBe(payload.userId);
      expect(verified.userType).toBe('admin');
    });

    it('should reject an invalid token', () => {
      expect(() => authService.verifyAccessToken('invalid-token')).toThrow();
    });
  });

  describe('Refresh tokens', () => {
    it('should create and use a refresh token', async () => {
      const user = await createUser();
      const { token } = await authService.createRefreshToken(user.id);

      const result = await authService.refresh(token);
      expect(result.userId).toBe(user.id);
      expect(result.token).toBeDefined();
    });

    it('should invalidate refresh token after logout', async () => {
      const user = await createUser();
      const { token } = await authService.createRefreshToken(user.id);

      await authService.logout(token);
      await expect(authService.refresh(token)).rejects.toThrow();
    });

    it('should invalidate all tokens on logoutAll', async () => {
      const user = await createUser();
      const { token: token1 } = await authService.createRefreshToken(user.id);
      const { token: token2 } = await authService.createRefreshToken(user.id);

      await authService.logoutAll(user.id);

      await expect(authService.refresh(token1)).rejects.toThrow();
      await expect(authService.refresh(token2)).rejects.toThrow();
    });
  });

  describe('Password management', () => {
    it('should change password with old password verification', async () => {
      const user = await createUser();
      await authService.createPasswordCredential(user.id, user.email, 'OldPass1!');

      await authService.changePassword(user.id, 'OldPass1!', 'NewPass1!');

      const result = await authService.verifyPasswordCredential(user.email, 'NewPass1!');
      expect(result.userId).toBe(user.id);
    });

    it('should reject password change with wrong old password', async () => {
      const user = await createUser();
      await authService.createPasswordCredential(user.id, user.email, 'OldPass1!');

      await expect(
        authService.changePassword(user.id, 'WrongOld!', 'NewPass1!'),
      ).rejects.toThrow();
    });

    it('should change password directly (admin reset)', async () => {
      const user = await createUser();
      await authService.createPasswordCredential(user.id, user.email, 'OldPass1!');

      await authService.changePasswordDirect(user.id, 'AdminReset1!');

      const result = await authService.verifyPasswordCredential(user.email, 'AdminReset1!');
      expect(result.userId).toBe(user.id);
    });
  });
});
