import { DEFAULT_PRESET_ID, getPresetById } from './presets';
import { DEFAULT_FONT_ID, getFontById, FONT_SCALE_VALUES } from './fonts';
import type { PaletteVars, ThemeConfig, ThemeMode } from './types';

export const DEFAULT_THEME: ThemeConfig = {
  presetId: DEFAULT_PRESET_ID,
  mode: 'system',
  fontFamily: DEFAULT_FONT_ID,
  fontScale: 'md',
  radius: 0.625,
};

/**
 * Merge a partial user theme with the defaults. Accepts anything — shape may
 * come from an older preference record, so everything is validated to fall
 * back to defaults on missing or unrecognized values.
 */
export function normalizeTheme(input: unknown): ThemeConfig {
  if (!input || typeof input !== 'object') return DEFAULT_THEME;
  const raw = input as Record<string, unknown>;

  const mode: ThemeMode =
    raw.mode === 'light' || raw.mode === 'dark' || raw.mode === 'system'
      ? raw.mode
      : DEFAULT_THEME.mode;

  const fontScale =
    raw.fontScale === 'sm' || raw.fontScale === 'md' || raw.fontScale === 'lg'
      ? raw.fontScale
      : DEFAULT_THEME.fontScale;

  const radius =
    typeof raw.radius === 'number' && raw.radius >= 0 && raw.radius <= 2
      ? raw.radius
      : DEFAULT_THEME.radius;

  const overrides = raw.overrides && typeof raw.overrides === 'object'
    ? (raw.overrides as Partial<PaletteVars>)
    : undefined;

  return {
    presetId: typeof raw.presetId === 'string' ? raw.presetId : DEFAULT_THEME.presetId,
    mode,
    fontFamily: typeof raw.fontFamily === 'string' ? raw.fontFamily : DEFAULT_THEME.fontFamily,
    fontScale,
    radius,
    overrides,
  };
}

/**
 * Resolve the effective palette for a theme config given whether the UI
 * should currently render as dark. Preset light/dark palettes are the base,
 * and the user's `overrides` are layered on top.
 */
export function resolvePalette(theme: ThemeConfig, isDark: boolean): PaletteVars {
  const preset = getPresetById(theme.presetId);
  const base = isDark ? preset.dark : preset.light;
  if (!theme.overrides) return base;
  return { ...base, ...theme.overrides };
}

export function resolveFontStack(theme: ThemeConfig): string {
  return getFontById(theme.fontFamily).stack;
}

export function resolveFontScale(theme: ThemeConfig): number {
  return FONT_SCALE_VALUES[theme.fontScale];
}
