import { describe, it, expect } from 'vitest';
import {
  AGENCY_PRESETS,
  DEFAULT_AGENCY_PRESET_ID,
  TYPOGRAPHY_SCALES,
  DEFAULT_SITE_THEME,
  getAgencyPreset,
  resolveSiteThemeCss,
  isSiteThemeDark,
  type AgencyPalette,
  type SiteTheme,
} from '../index';

const PALETTE_KEYS: (keyof AgencyPalette)[] = [
  'primary',
  'primaryForeground',
  'accent',
  'accentForeground',
  'ring',
  'background',
  'foreground',
  'card',
  'cardForeground',
  'popover',
  'popoverForeground',
  'secondary',
  'secondaryForeground',
  'muted',
  'mutedForeground',
  'border',
  'input',
];

describe('AGENCY_PRESETS', () => {
  it('ships six presets', () => {
    expect(AGENCY_PRESETS).toHaveLength(6);
  });

  it('has unique ids', () => {
    const ids = AGENCY_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every preset exposes id, name, description, swatch, light, and dark palettes', () => {
    for (const preset of AGENCY_PRESETS) {
      expect(preset.id).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(preset.name).toBeTruthy();
      expect(preset.description).toBeTruthy();
      expect(preset.swatch).toMatch(/^hsl\(/);
      for (const key of PALETTE_KEYS) {
        expect(preset.light[key], `${preset.id}.light.${key}`).toBeTruthy();
        expect(preset.dark[key], `${preset.id}.dark.${key}`).toBeTruthy();
      }
    }
  });

  it('includes the expected curated ids', () => {
    const ids = AGENCY_PRESETS.map((p) => p.id);
    expect(ids).toEqual(
      expect.arrayContaining(['minimal', 'bold', 'editorial', 'studio-dark', 'warm', 'monochrome']),
    );
  });

  it('DEFAULT_AGENCY_PRESET_ID resolves to a preset', () => {
    expect(AGENCY_PRESETS.find((p) => p.id === DEFAULT_AGENCY_PRESET_ID)).toBeDefined();
  });

  it('DEFAULT_SITE_THEME points at a valid preset', () => {
    expect(AGENCY_PRESETS.find((p) => p.id === DEFAULT_SITE_THEME.presetId)).toBeDefined();
  });
});

describe('getAgencyPreset', () => {
  it('returns the preset for a known id', () => {
    const preset = getAgencyPreset('bold');
    expect(preset.id).toBe('bold');
    expect(preset.name).toBe('Bold');
  });

  it('falls back to the first preset for an unknown id', () => {
    const preset = getAgencyPreset('does-not-exist');
    expect(preset).toBe(AGENCY_PRESETS[0]);
  });
});

describe('resolveSiteThemeCss', () => {
  const baseTheme: SiteTheme = { ...DEFAULT_SITE_THEME };

  it('emits all 18 CSS variables', () => {
    const vars = resolveSiteThemeCss(baseTheme, false);
    const keys = Object.keys(vars).sort();
    expect(keys).toEqual(
      [
        '--accent',
        '--accent-foreground',
        '--background',
        '--border',
        '--card',
        '--card-foreground',
        '--foreground',
        '--input',
        '--muted',
        '--muted-foreground',
        '--popover',
        '--popover-foreground',
        '--primary',
        '--primary-foreground',
        '--radius',
        '--ring',
        '--secondary',
        '--secondary-foreground',
      ].sort(),
    );
  });

  it('returns the light palette when isDark is false', () => {
    const preset = getAgencyPreset(baseTheme.presetId);
    const vars = resolveSiteThemeCss(baseTheme, false);
    expect(vars['--background']).toBe(preset.light.background);
    expect(vars['--foreground']).toBe(preset.light.foreground);
    expect(vars['--primary']).toBe(preset.light.primary);
  });

  it('returns the dark palette when isDark is true', () => {
    const preset = getAgencyPreset(baseTheme.presetId);
    const vars = resolveSiteThemeCss(baseTheme, true);
    expect(vars['--background']).toBe(preset.dark.background);
    expect(vars['--foreground']).toBe(preset.dark.foreground);
    expect(vars['--primary']).toBe(preset.dark.primary);
  });

  it('accentOverride wins over the preset primary and ring', () => {
    const override = '22 90% 52%';
    const vars = resolveSiteThemeCss({ ...baseTheme, accentOverride: override }, false);
    expect(vars['--primary']).toBe(override);
    expect(vars['--ring']).toBe(override);
  });

  it('accentOverride does not leak into accent / accent-foreground', () => {
    const preset = getAgencyPreset(baseTheme.presetId);
    const vars = resolveSiteThemeCss({ ...baseTheme, accentOverride: '180 50% 50%' }, false);
    expect(vars['--accent']).toBe(preset.light.accent);
    expect(vars['--accent-foreground']).toBe(preset.light.accentForeground);
  });

  it('falls back to the first preset when presetId is unknown', () => {
    const first = AGENCY_PRESETS[0];
    const vars = resolveSiteThemeCss({ ...baseTheme, presetId: 'nope' }, false);
    expect(vars['--background']).toBe(first.light.background);
  });

  it('serialises radius as a rem string', () => {
    const vars = resolveSiteThemeCss({ ...baseTheme, radius: 1.25 }, false);
    expect(vars['--radius']).toBe('1.25rem');
  });

  it('serialises zero radius correctly', () => {
    const vars = resolveSiteThemeCss({ ...baseTheme, radius: 0 }, false);
    expect(vars['--radius']).toBe('0rem');
  });
});

describe('isSiteThemeDark', () => {
  const light: SiteTheme = { ...DEFAULT_SITE_THEME, mode: 'light' };
  const dark: SiteTheme = { ...DEFAULT_SITE_THEME, mode: 'dark' };
  const system: SiteTheme = { ...DEFAULT_SITE_THEME, mode: 'system' };

  it('mode=light is always light, regardless of system hint', () => {
    expect(isSiteThemeDark(light, true)).toBe(false);
    expect(isSiteThemeDark(light, false)).toBe(false);
  });

  it('mode=dark is always dark, regardless of system hint', () => {
    expect(isSiteThemeDark(dark, false)).toBe(true);
    expect(isSiteThemeDark(dark, true)).toBe(true);
  });

  it('mode=system passes through the system hint', () => {
    expect(isSiteThemeDark(system, true)).toBe(true);
    expect(isSiteThemeDark(system, false)).toBe(false);
  });
});

describe('TYPOGRAPHY_SCALES', () => {
  it('exposes the three named scales', () => {
    expect(Object.keys(TYPOGRAPHY_SCALES).sort()).toEqual(['compact', 'editorial', 'standard']);
  });

  it('has a positive fontSizeRem and a label for each scale', () => {
    for (const [id, scale] of Object.entries(TYPOGRAPHY_SCALES)) {
      expect(scale.fontSizeRem, `${id}.fontSizeRem`).toBeGreaterThan(0);
      expect(scale.label, `${id}.label`).toBeTruthy();
      expect(scale.description, `${id}.description`).toBeTruthy();
    }
  });

  it('DEFAULT_SITE_THEME.typography references a registered scale', () => {
    expect(TYPOGRAPHY_SCALES[DEFAULT_SITE_THEME.typography]).toBeDefined();
  });
});
