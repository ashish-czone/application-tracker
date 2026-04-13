import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { createIntegrationTestModule, cleanDatabase } from '@packages/testing';
import { RbacModule } from '@packages/rbac';
import { EventsModule } from '@packages/events';
import { SettingsModule } from '../../settings.module';
import { SettingsStoreService } from '../settings-store.service';
import type { DrizzleDB } from '@packages/database';
import type { TestingModule } from '@nestjs/testing';

describe('SettingsStoreService (integration)', () => {
  let module: TestingModule;
  let db: DrizzleDB;
  let store: SettingsStoreService;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const ctx = await createIntegrationTestModule({
      imports: [EventsModule, RbacModule, SettingsModule],
    });
    module = ctx.module;
    db = ctx.db;
    cleanup = ctx.cleanup;
    store = module.get(SettingsStoreService);
  });

  afterEach(async () => {
    await cleanDatabase(db);
    await store.loadAll();
  });

  afterAll(async () => {
    await cleanup();
  });

  describe('upsert', () => {
    it('should insert a new setting and update cache', async () => {
      await store.upsert('email', 'fromAddress', 'test@example.com', 'user-1');

      const cached = store.getCached('email', 'fromAddress');
      expect(cached).toBe('test@example.com');
    });

    it('should update an existing setting', async () => {
      await store.upsert('email', 'fromAddress', 'old@example.com', 'user-1');
      await store.upsert('email', 'fromAddress', 'new@example.com', 'user-1');

      const cached = store.getCached('email', 'fromAddress');
      expect(cached).toBe('new@example.com');
    });

    it('should store JSON values', async () => {
      const value = { host: 'smtp.example.com', port: 587, ssl: true };
      await store.upsert('email', 'smtpConfig', value, 'user-1');

      const cached = store.getCached('email', 'smtpConfig');
      expect(cached).toEqual(value);
    });

    it('should isolate settings by module', async () => {
      await store.upsert('email', 'enabled', true, 'user-1');
      await store.upsert('sms', 'enabled', false, 'user-1');

      expect(store.getCached('email', 'enabled')).toBe(true);
      expect(store.getCached('sms', 'enabled')).toBe(false);
    });
  });

  describe('loadAll', () => {
    it('should load all settings from database into cache', async () => {
      await store.upsert('email', 'fromAddress', 'test@example.com', 'user-1');
      await store.upsert('email', 'fromName', 'Test App', 'user-1');
      await store.upsert('sms', 'provider', 'twilio', 'user-1');

      // Clear cache and reload
      await store.loadAll();

      expect(store.getCached('email', 'fromAddress')).toBe('test@example.com');
      expect(store.getCached('email', 'fromName')).toBe('Test App');
      expect(store.getCached('sms', 'provider')).toBe('twilio');
    });

    it('should return undefined for non-existent keys', () => {
      expect(store.getCached('nonexistent', 'key')).toBeUndefined();
    });
  });

  describe('getAllCachedByModule', () => {
    it('should return all settings for a module as a record', async () => {
      await store.upsert('email', 'fromAddress', 'test@example.com', 'user-1');
      await store.upsert('email', 'fromName', 'Test App', 'user-1');

      const result = store.getAllCachedByModule('email');
      expect(result).toEqual({
        fromAddress: 'test@example.com',
        fromName: 'Test App',
      });
    });

    it('should return empty object for non-existent module', () => {
      expect(store.getAllCachedByModule('nonexistent')).toEqual({});
    });
  });

  describe('remove', () => {
    it('should delete setting from database and cache', async () => {
      await store.upsert('email', 'fromAddress', 'test@example.com', 'user-1');
      await store.remove('email', 'fromAddress');

      expect(store.getCached('email', 'fromAddress')).toBeUndefined();
    });

    it('should not affect other settings in the same module', async () => {
      await store.upsert('email', 'fromAddress', 'test@example.com', 'user-1');
      await store.upsert('email', 'fromName', 'Test App', 'user-1');
      await store.remove('email', 'fromAddress');

      expect(store.getCached('email', 'fromAddress')).toBeUndefined();
      expect(store.getCached('email', 'fromName')).toBe('Test App');
    });

    it('should persist removal across cache reloads', async () => {
      await store.upsert('email', 'fromAddress', 'test@example.com', 'user-1');
      await store.remove('email', 'fromAddress');
      await store.loadAll();

      expect(store.getCached('email', 'fromAddress')).toBeUndefined();
    });
  });
});
