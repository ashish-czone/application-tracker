import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createPackageTestApp, withAuth, cleanDatabase, type PackageTestApp } from '@packages/platform-testing';
import { SettingsModule } from '../../settings.module';
import { AppConfigService } from '../../services/app-config.service';
import { SETTINGS_PERMISSIONS } from '../../permissions';

const READ = [SETTINGS_PERMISSIONS.READ];
const MANAGE = [...READ, SETTINGS_PERMISSIONS.MANAGE];

describe('SettingsController (integration)', () => {
  let ctx: PackageTestApp;
  let appConfig: AppConfigService;

  beforeAll(async () => {
    ctx = await createPackageTestApp({
      imports: [SettingsModule],
    });
    appConfig = ctx.module.get(AppConfigService);
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  beforeEach(async () => {
    await cleanDatabase(ctx.db);
    // Register test settings module
    appConfig.register('test-module', {
      label: 'Test Module',
      defaults: {
        timeout: 30,
        retryCount: 3,
        enableFeatureX: false,
      },
      metadata: {
        timeout: { label: 'Timeout (seconds)', type: 'number' },
        retryCount: { label: 'Retry Count', type: 'number' },
        enableFeatureX: { label: 'Enable Feature X', type: 'boolean' },
      },
    });
  });

  // ── List all settings ──────────────────────────────────────

  describe('GET /api/v1/settings', () => {
    it('should list all registered settings', async () => {
      const res = await request(ctx.httpServer)
        .get('/api/v1/settings')
        .set(withAuth(READ))
        .expect(200);

      expect(res.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            module: 'test-module',
            label: 'Test Module',
          }),
        ]),
      );
    });

    it('should include field defaults', async () => {
      const res = await request(ctx.httpServer)
        .get('/api/v1/settings')
        .set(withAuth(READ))
        .expect(200);

      const testGroup = res.body.find((g: any) => g.module === 'test-module');
      const timeoutField = testGroup.fields.find((f: any) => f.key === 'timeout');
      expect(timeoutField.value).toBe(30);
      expect(timeoutField.default).toBe(30);
      expect(timeoutField.isOverridden).toBe(false);
    });
  });

  // ── Get by module ──────────────────────────────────────

  describe('GET /api/v1/settings/:module', () => {
    it('should return settings for a specific module', async () => {
      const res = await request(ctx.httpServer)
        .get('/api/v1/settings/test-module')
        .set(withAuth(READ))
        .expect(200);

      expect(res.body.module).toBe('test-module');
      expect(res.body.fields.length).toBe(3);
    });

    it('should 404 for unregistered module', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/settings/nonexistent')
        .set(withAuth(READ))
        .expect(404);
    });
  });

  // ── Update setting ──────────────────────────────────────

  describe('PATCH /api/v1/settings/:module/:key', () => {
    it('should update a setting value', async () => {
      const res = await request(ctx.httpServer)
        .patch('/api/v1/settings/test-module/timeout')
        .set(withAuth(MANAGE))
        .send({ value: 60 })
        .expect(200);

      const timeoutField = res.body.fields.find((f: any) => f.key === 'timeout');
      expect(timeoutField.value).toBe(60);
      expect(timeoutField.isOverridden).toBe(true);
    });

    it('should 404 for invalid key', async () => {
      await request(ctx.httpServer)
        .patch('/api/v1/settings/test-module/nonexistent-key')
        .set(withAuth(MANAGE))
        .send({ value: 'anything' })
        .expect(404);
    });

    it('should 404 for unregistered module', async () => {
      await request(ctx.httpServer)
        .patch('/api/v1/settings/nonexistent/key')
        .set(withAuth(MANAGE))
        .send({ value: 'anything' })
        .expect(404);
    });
  });

  // ── Reset setting ──────────────────────────────────────

  describe('DELETE /api/v1/settings/:module/:key', () => {
    it('should reset a setting to its default', async () => {
      // First override
      await request(ctx.httpServer)
        .patch('/api/v1/settings/test-module/timeout')
        .set(withAuth(MANAGE))
        .send({ value: 120 })
        .expect(200);

      // Then reset
      const res = await request(ctx.httpServer)
        .delete('/api/v1/settings/test-module/timeout')
        .set(withAuth(MANAGE))
        .expect(200);

      const timeoutField = res.body.fields.find((f: any) => f.key === 'timeout');
      expect(timeoutField.value).toBe(30);
      expect(timeoutField.isOverridden).toBe(false);
    });
  });

  // ── Auth ──────────────────────────────────────────────────

  describe('Auth enforcement', () => {
    it('should return 401 without auth', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/settings')
        .expect(401);
    });
  });
});
