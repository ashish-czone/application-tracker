import { describe, it, expect } from 'vitest';
import { DEFAULT_SITE_THEME } from '@domains/agency-contract';
import { SITE_DEFAULTS, SITE_SETTINGS, PUBLIC_SITE_KEYS } from '../settings';

const EXPECTED_HIDDEN_KEYS = ['companyLogo', 'defaultSeo.ogImage', 'theme'] as const;

describe('SITE_DEFAULTS', () => {
  it('theme default is DEFAULT_SITE_THEME (structured object, not string)', () => {
    expect(SITE_DEFAULTS.theme).toEqual(DEFAULT_SITE_THEME);
    expect(typeof SITE_DEFAULTS.theme).toBe('object');
  });

  it('scalar string defaults are plain strings', () => {
    const stringKeys: (keyof typeof SITE_DEFAULTS)[] = [
      'companyName',
      'companyLogo',
      'siteName',
      'tagline',
      'description',
      'contactEmail',
      'contactPhone',
      'address',
      'social.twitter',
      'social.linkedin',
      'social.instagram',
      'social.github',
      'social.youtube',
      'defaultSeo.title',
      'defaultSeo.description',
      'defaultSeo.ogImage',
      'analytics.ga4',
      'analytics.posthog',
    ];
    for (const key of stringKeys) {
      expect(typeof SITE_DEFAULTS[key], key).toBe('string');
    }
  });

  it('media-reference defaults are empty strings (no accidental URLs)', () => {
    expect(SITE_DEFAULTS.companyLogo).toBe('');
    expect(SITE_DEFAULTS['defaultSeo.ogImage']).toBe('');
  });
});

describe('SITE_SETTINGS', () => {
  it('defaults mirror SITE_DEFAULTS exactly', () => {
    expect(SITE_SETTINGS.defaults).toEqual(SITE_DEFAULTS);
  });

  it('every default key has metadata', () => {
    for (const key of Object.keys(SITE_DEFAULTS)) {
      expect(SITE_SETTINGS.metadata[key], `metadata for ${key}`).toBeDefined();
    }
  });

  it('every metadata key has a default (no orphans)', () => {
    for (const key of Object.keys(SITE_SETTINGS.metadata)) {
      expect(key in SITE_DEFAULTS, `default for ${key}`).toBe(true);
    }
  });

  it('every metadata entry declares a label and type', () => {
    for (const [key, meta] of Object.entries(SITE_SETTINGS.metadata)) {
      expect(meta.label, `${key}.label`).toBeTruthy();
      expect(meta.type, `${key}.type`).toMatch(/^(string|number|boolean|password)$/);
    }
  });

  it('marks exactly companyLogo, defaultSeo.ogImage, and theme as hidden', () => {
    const hiddenKeys = Object.entries(SITE_SETTINGS.metadata)
      .filter(([, meta]) => meta.hidden === true)
      .map(([key]) => key)
      .sort();
    expect(hiddenKeys).toEqual([...EXPECTED_HIDDEN_KEYS].sort());
  });

  it('has a top-level label', () => {
    expect(SITE_SETTINGS.label).toBe('Site');
  });
});

describe('PUBLIC_SITE_KEYS', () => {
  it('every whitelisted key has a default', () => {
    for (const key of PUBLIC_SITE_KEYS) {
      expect(key in SITE_DEFAULTS, `${key} in SITE_DEFAULTS`).toBe(true);
    }
  });

  it('contains every SITE_DEFAULTS key (no hidden private keys)', () => {
    const defaultKeys = Object.keys(SITE_DEFAULTS).sort();
    const publicKeys = [...PUBLIC_SITE_KEYS].sort();
    expect(publicKeys).toEqual(defaultKeys);
  });

  it('has no duplicate entries', () => {
    expect(new Set(PUBLIC_SITE_KEYS).size).toBe(PUBLIC_SITE_KEYS.length);
  });
});
