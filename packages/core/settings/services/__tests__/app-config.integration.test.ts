import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { createIntegrationTestModule, cleanDatabase } from '@packages/testing';
import { RbacModule } from '@packages/rbac';
import { EventsModule } from '@packages/events';
import { SettingsModule } from '../../settings.module';
import { AppConfigService } from '../app-config.service';
import { SettingsStoreService } from '../settings-store.service';
import type { DrizzleDB } from '@packages/database';
import type { TestingModule } from '@nestjs/testing';

describe('AppConfigService (integration)', () => {
  let module: TestingModule;
  let db: DrizzleDB;
  let config: AppConfigService;
  let store: SettingsStoreService;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const ctx = await createIntegrationTestModule({
      imports: [EventsModule, RbacModule, SettingsModule],
    });
    module = ctx.module;
    db = ctx.db;
    cleanup = ctx.cleanup;
    config = module.get(AppConfigService);
    store = module.get(SettingsStoreService);

    config.register('email', {
      label: 'Email Settings',
      defaults: {
        fromAddress: 'default@example.com',
        fromName: 'Default App',
        smtpPort: 587,
      },
      metadata: {
        fromAddress: { label: 'From Address', type: 'string' },
        fromName: { label: 'From Name', type: 'string' },
        smtpPort: { label: 'SMTP Port', type: 'number' },
      },
    });
  });

  afterEach(async () => {
    await cleanDatabase(db);
    await store.loadAll();
  });

  afterAll(async () => {
    await cleanup();
  });

  describe('get', () => {
    it('should return registered default when no DB override exists', () => {
      const value = config.get('email', 'fromAddress');
      expect(value).toBe('default@example.com');
    });

    it('should return DB override when one exists', async () => {
      await config.set('email', 'fromAddress', 'override@example.com', 'user-1');

      const value = config.get('email', 'fromAddress');
      expect(value).toBe('override@example.com');
    });

    it('should persist override across cache reloads', async () => {
      await config.set('email', 'fromAddress', 'override@example.com', 'user-1');
      await store.loadAll();

      const value = config.get('email', 'fromAddress');
      expect(value).toBe('override@example.com');
    });

    it('should throw NotFoundException for unregistered module', () => {
      expect(() => config.get('nonexistent', 'key')).toThrow();
    });
  });

  describe('set', () => {
    it('should persist a setting override to the database', async () => {
      await config.set('email', 'fromName', 'Custom Name', 'user-1');

      // Verify via direct cache read
      expect(store.getCached('email', 'fromName')).toBe('Custom Name');
    });

    it('should reject keys not in the registered defaults', async () => {
      await expect(
        config.set('email', 'invalidKey', 'value', 'user-1'),
      ).rejects.toThrow();
    });

    it('should reject unregistered modules', async () => {
      await expect(
        config.set('nonexistent', 'key', 'value', 'user-1'),
      ).rejects.toThrow();
    });
  });

  describe('reset', () => {
    it('should remove the DB override and fall back to default', async () => {
      await config.set('email', 'fromAddress', 'override@example.com', 'user-1');
      await config.reset('email', 'fromAddress');

      const value = config.get('email', 'fromAddress');
      expect(value).toBe('default@example.com');
    });
  });

  describe('getAll / getByModule', () => {
    it('should return all registered modules with current values', async () => {
      await config.set('email', 'fromAddress', 'override@example.com', 'user-1');

      const groups = config.getAll();
      const emailGroup = groups.find((g) => g.module === 'email');
      expect(emailGroup).toBeDefined();

      const fromAddr = emailGroup!.fields.find((f) => f.key === 'fromAddress');
      expect(fromAddr!.value).toBe('override@example.com');
      expect(fromAddr!.isOverridden).toBe(true);
    });

    it('should mark non-overridden fields correctly', () => {
      const group = config.getByModule('email');
      const fromAddr = group.fields.find((f) => f.key === 'fromAddress');
      expect(fromAddr!.value).toBe('default@example.com');
      expect(fromAddr!.isOverridden).toBe(false);
    });
  });
});
