import { describe, it, expect, vi } from 'vitest';
import type { AppConfigService } from '@packages/settings';
import type { MediaAssetsResolverService } from '@packages/media-library-api';
import { DEFAULT_SITE_THEME, type SiteTheme } from '@domains/agency-contract';
import { SiteSettingsController } from '../site-settings.controller';
import { PUBLIC_SITE_KEYS, SITE_DEFAULTS } from '../settings';

function makeAppConfig(overrides: Partial<Record<string, unknown>> = {}): AppConfigService {
  return {
    get: vi.fn((module: string, key: string) => {
      if (module !== 'site') throw new Error(`unexpected module ${module}`);
      if (key in overrides) return overrides[key];
      return (SITE_DEFAULTS as Record<string, unknown>)[key];
    }),
  } as unknown as AppConfigService;
}

function makeResolver(urlsById: Record<string, string> = {}): MediaAssetsResolverService {
  return {
    resolveUrls: vi.fn(async (ids: readonly string[]) => {
      const out = new Map<string, string>();
      for (const id of ids) {
        if (id in urlsById) out.set(id, urlsById[id]);
      }
      return out;
    }),
  } as unknown as MediaAssetsResolverService;
}

describe('SiteSettingsController', () => {
  it('returns every whitelisted key with its default value', async () => {
    const controller = new SiteSettingsController(makeAppConfig(), makeResolver());

    const result = await controller.get();

    for (const key of PUBLIC_SITE_KEYS) {
      expect(result).toHaveProperty(key);
      expect(result[key]).toEqual((SITE_DEFAULTS as Record<string, unknown>)[key]);
    }
  });

  it('returns the theme default as a structured object, not a string', async () => {
    const controller = new SiteSettingsController(makeAppConfig(), makeResolver());

    const result = await controller.get();

    expect(result.theme).toEqual(DEFAULT_SITE_THEME);
    expect(typeof result.theme).toBe('object');
  });

  it('passes through an admin-overridden theme object', async () => {
    const overriddenTheme: SiteTheme = {
      ...DEFAULT_SITE_THEME,
      presetId: 'bold',
      mode: 'dark',
      accentOverride: '22 90% 52%',
    };
    const controller = new SiteSettingsController(
      makeAppConfig({ theme: overriddenTheme }),
      makeResolver(),
    );

    const result = await controller.get();

    expect(result.theme).toEqual(overriddenTheme);
  });

  it('reflects admin overrides on scalar keys', async () => {
    const controller = new SiteSettingsController(
      makeAppConfig({ siteName: 'Override Studio', 'social.twitter': 'https://x.com/override' }),
      makeResolver(),
    );

    const result = await controller.get();

    expect(result.siteName).toBe('Override Studio');
    expect(result['social.twitter']).toBe('https://x.com/override');
    expect(result.tagline).toBe(SITE_DEFAULTS.tagline);
  });

  it('exposes only whitelisted keys — no unintended leakage', async () => {
    const controller = new SiteSettingsController(makeAppConfig(), makeResolver());

    const result = await controller.get();
    const returned = Object.keys(result).sort();
    const expected = [...PUBLIC_SITE_KEYS].sort();

    expect(returned).toEqual(expected);
  });

  it('queries only the `site` module', async () => {
    const appConfig = makeAppConfig();
    const controller = new SiteSettingsController(appConfig, makeResolver());

    await controller.get();

    for (const call of (appConfig.get as ReturnType<typeof vi.fn>).mock.calls) {
      expect(call[0]).toBe('site');
    }
  });

  it('resolves companyLogo and defaultSeo.ogImage UUIDs to public URLs', async () => {
    const logoId = '11111111-1111-1111-1111-111111111111';
    const ogId = '22222222-2222-2222-2222-222222222222';
    const resolver = makeResolver({
      [logoId]: 'https://cdn.example.com/logo.png',
      [ogId]: 'https://cdn.example.com/og.jpg',
    });
    const controller = new SiteSettingsController(
      makeAppConfig({ companyLogo: logoId, 'defaultSeo.ogImage': ogId }),
      resolver,
    );

    const result = await controller.get();

    expect(result.companyLogo).toBe('https://cdn.example.com/logo.png');
    expect(result['defaultSeo.ogImage']).toBe('https://cdn.example.com/og.jpg');
    expect(resolver.resolveUrls).toHaveBeenCalledWith([logoId, ogId]);
  });

  it('returns an empty string for an unresolvable media reference', async () => {
    const missingId = '33333333-3333-3333-3333-333333333333';
    const controller = new SiteSettingsController(
      makeAppConfig({ companyLogo: missingId }),
      makeResolver(),
    );

    const result = await controller.get();

    expect(result.companyLogo).toBe('');
  });

  it('skips the resolver call entirely when no media references are set', async () => {
    const resolver = makeResolver();
    const controller = new SiteSettingsController(makeAppConfig(), resolver);

    await controller.get();

    expect(resolver.resolveUrls).toHaveBeenCalledWith([]);
  });
});
