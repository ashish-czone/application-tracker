import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import {
  createPackageTestApp,
  cleanDatabase,
  type PackageTestApp,
} from '@packages/platform-testing';
import { AppConfigService, SettingsModule } from '@packages/settings';
import { SettingsStoreService } from '@packages/settings/services/settings-store.service';
import { MediaAssetsResolverService, mediaAssets } from '@packages/media-library-api';
import { DEFAULT_SITE_THEME } from '@domains/agency-contract';
import { SiteSettingsController } from '../site-settings.controller';
import { PUBLIC_SITE_KEYS, SITE_DEFAULTS, SITE_SETTINGS } from '../settings';

/**
 * Boots the site-settings controller end-to-end against a real Postgres.
 * Only the direct collaborators (`SettingsModule`, `MediaAssetsResolverService`)
 * are wired — the full `MediaLibraryModule` pulls in an upload service that
 * requires `@packages/media`'s dynamic `MediaModule.register(…)` config, which
 * is app-level concern and not part of the public-endpoint contract we're
 * testing. `SITE_SETTINGS` is registered manually to mirror what
 * `AgencyDomainModule.onModuleInit` does.
 */
describe('SiteSettingsController (integration)', () => {
  let ctx: PackageTestApp;
  let appConfig: AppConfigService;
  let store: SettingsStoreService;
  let testUserId: string;

  beforeAll(async () => {
    ctx = await createPackageTestApp({
      imports: [SettingsModule],
      controllers: [SiteSettingsController],
      providers: [MediaAssetsResolverService],
    });
    appConfig = ctx.module.get(AppConfigService);
    store = ctx.module.get(SettingsStoreService);
    appConfig.register('site', SITE_SETTINGS);
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  beforeEach(async () => {
    await cleanDatabase(ctx.db);
    // cleanDatabase truncates the `settings` table too — reload the cache so
    // overrides from previous tests don't bleed through.
    await store.loadAll();
    testUserId = randomUUID();
    await ctx.db.execute(
      sql`INSERT INTO users (id, email, first_name, last_name, user_type, updated_at)
          VALUES (${testUserId}, ${`test-${Date.now()}-${randomUUID()}@example.com`}, ${'Test'}, ${'User'}, ${'admin'}, NOW())`,
    );
  });

  async function insertMediaAsset(url: string): Promise<string> {
    const id = randomUUID();
    await ctx.db.insert(mediaAssets).values({
      id,
      storageKey: `test/${id}.png`,
      url,
      originalName: `${id}.png`,
      mimeType: 'image/png',
      size: 1024,
      createdBy: testUserId,
    });
    return id;
  }

  // ── Anonymous access ────────────────────────────────────────

  it('is publicly accessible (no auth header required)', async () => {
    await request(ctx.httpServer).get('/api/v1/public/site-settings').expect(200);
  });

  // ── Defaults ────────────────────────────────────────────────

  it('returns every whitelisted key with its default value', async () => {
    const res = await request(ctx.httpServer)
      .get('/api/v1/public/site-settings')
      .expect(200);

    for (const key of PUBLIC_SITE_KEYS) {
      expect(res.body).toHaveProperty(key);
    }
    expect(res.body.siteName).toBe(SITE_DEFAULTS.siteName);
    expect(res.body.tagline).toBe(SITE_DEFAULTS.tagline);
    expect(res.body.companyLogo).toBe('');
    expect(res.body['defaultSeo.ogImage']).toBe('');
  });

  it('returns the theme default as a structured object', async () => {
    const res = await request(ctx.httpServer)
      .get('/api/v1/public/site-settings')
      .expect(200);

    expect(res.body.theme).toEqual(DEFAULT_SITE_THEME);
    expect(typeof res.body.theme).toBe('object');
  });

  it('exposes exactly the whitelisted keys — nothing more', async () => {
    const res = await request(ctx.httpServer)
      .get('/api/v1/public/site-settings')
      .expect(200);

    expect(Object.keys(res.body).sort()).toEqual([...PUBLIC_SITE_KEYS].sort());
  });

  // ── Admin overrides ─────────────────────────────────────────

  it('reflects scalar overrides persisted via AppConfigService', async () => {
    await appConfig.set('site', 'siteName', 'Override Studio', testUserId);
    await appConfig.set(
      'site',
      'social.twitter',
      'https://x.com/override',
      testUserId,
    );

    const res = await request(ctx.httpServer)
      .get('/api/v1/public/site-settings')
      .expect(200);

    expect(res.body.siteName).toBe('Override Studio');
    expect(res.body['social.twitter']).toBe('https://x.com/override');
    // Unchanged keys still return defaults.
    expect(res.body.tagline).toBe(SITE_DEFAULTS.tagline);
  });

  it('reflects theme overrides as structured objects', async () => {
    const overridden = {
      ...DEFAULT_SITE_THEME,
      presetId: 'bold',
      mode: 'dark' as const,
      accentOverride: '22 90% 52%',
    };
    await appConfig.set('site', 'theme', overridden, testUserId);

    const res = await request(ctx.httpServer)
      .get('/api/v1/public/site-settings')
      .expect(200);

    expect(res.body.theme).toEqual(overridden);
  });

  // ── Media resolution ────────────────────────────────────────

  it('resolves companyLogo UUID to the media asset URL', async () => {
    const logoId = await insertMediaAsset('https://cdn.example.com/logo.png');
    await appConfig.set('site', 'companyLogo', logoId, testUserId);

    const res = await request(ctx.httpServer)
      .get('/api/v1/public/site-settings')
      .expect(200);

    expect(res.body.companyLogo).toBe('https://cdn.example.com/logo.png');
  });

  it('resolves defaultSeo.ogImage UUID to the media asset URL', async () => {
    const ogId = await insertMediaAsset('https://cdn.example.com/og.jpg');
    await appConfig.set('site', 'defaultSeo.ogImage', ogId, testUserId);

    const res = await request(ctx.httpServer)
      .get('/api/v1/public/site-settings')
      .expect(200);

    expect(res.body['defaultSeo.ogImage']).toBe('https://cdn.example.com/og.jpg');
  });

  it('returns an empty string for an unknown media UUID', async () => {
    await appConfig.set('site', 'companyLogo', randomUUID(), testUserId);

    const res = await request(ctx.httpServer)
      .get('/api/v1/public/site-settings')
      .expect(200);

    expect(res.body.companyLogo).toBe('');
  });

  it('returns an empty string when the referenced media asset is soft-deleted', async () => {
    const logoId = await insertMediaAsset('https://cdn.example.com/logo.png');
    await ctx.db
      .update(mediaAssets)
      .set({ deletedAt: new Date(), deletedBy: testUserId })
      .where(sql`id = ${logoId}`);
    await appConfig.set('site', 'companyLogo', logoId, testUserId);

    const res = await request(ctx.httpServer)
      .get('/api/v1/public/site-settings')
      .expect(200);

    expect(res.body.companyLogo).toBe('');
  });

  it('resolves logo and OG image in a single request', async () => {
    const logoId = await insertMediaAsset('https://cdn.example.com/logo.png');
    const ogId = await insertMediaAsset('https://cdn.example.com/og.jpg');
    await appConfig.set('site', 'companyLogo', logoId, testUserId);
    await appConfig.set('site', 'defaultSeo.ogImage', ogId, testUserId);

    const res = await request(ctx.httpServer)
      .get('/api/v1/public/site-settings')
      .expect(200);

    expect(res.body.companyLogo).toBe('https://cdn.example.com/logo.png');
    expect(res.body['defaultSeo.ogImage']).toBe('https://cdn.example.com/og.jpg');
  });
});
