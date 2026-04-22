import { describe, it, expect, vi } from 'vitest';
import type { AppConfigService } from '@packages/settings';
import { SiteSettingsController } from '../site-settings.controller';
import { PUBLIC_SITE_KEYS, SITE_DEFAULTS } from '../settings';

function makeAppConfig(overrides: Partial<Record<string, string>> = {}): AppConfigService {
  return {
    get: vi.fn((module: string, key: string) => {
      if (module !== 'site') throw new Error(`unexpected module ${module}`);
      return overrides[key] ?? (SITE_DEFAULTS as Record<string, string>)[key];
    }),
  } as unknown as AppConfigService;
}

describe('SiteSettingsController', () => {
  it('returns every whitelisted key with its default value', () => {
    const appConfig = makeAppConfig();
    const controller = new SiteSettingsController(appConfig);

    const result = controller.get();

    for (const key of PUBLIC_SITE_KEYS) {
      expect(result).toHaveProperty(key);
      expect(result[key]).toBe((SITE_DEFAULTS as Record<string, string>)[key]);
    }
  });

  it('reflects admin overrides', () => {
    const appConfig = makeAppConfig({
      siteName: 'Override Studio',
      'social.twitter': 'https://x.com/override',
    });
    const controller = new SiteSettingsController(appConfig);

    const result = controller.get();

    expect(result.siteName).toBe('Override Studio');
    expect(result['social.twitter']).toBe('https://x.com/override');
    expect(result.tagline).toBe(SITE_DEFAULTS.tagline);
  });

  it('exposes only whitelisted keys — no unintended leakage', () => {
    const appConfig = makeAppConfig();
    const controller = new SiteSettingsController(appConfig);

    const result = controller.get();
    const returned = Object.keys(result).sort();
    const expected = [...PUBLIC_SITE_KEYS].sort();

    expect(returned).toEqual(expected);
  });

  it('queries only the `site` module', () => {
    const appConfig = makeAppConfig();
    const controller = new SiteSettingsController(appConfig);

    controller.get();

    for (const call of (appConfig.get as ReturnType<typeof vi.fn>).mock.calls) {
      expect(call[0]).toBe('site');
    }
  });
});
