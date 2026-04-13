import { DEFAULT_PRESET_ID, getPresetById } from './presets';
import { AUTO_NEUTRAL_ID, getNeutralById } from './neutrals';
import { DEFAULT_FONT_ID, getFontById, FONT_SCALE_VALUES } from './fonts';
import type {
  AccentVars,
  NeutralVars,
  PaletteVars,
  ThemeConfig,
  ThemeMode,
  ThemeOverrides,
} from './types';

export const DEFAULT_THEME: ThemeConfig = {
  presetId: DEFAULT_PRESET_ID,
  neutralId: AUTO_NEUTRAL_ID,
  mode: 'system',
  fontFamily: DEFAULT_FONT_ID,
  fontScale: 'md',
  radius: 0.625,
};

function normalizeOverrides(raw: unknown): ThemeOverrides | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const accent = r.accent && typeof r.accent === 'object' ? (r.accent as Partial<AccentVars>) : undefined;
  const neutral = r.neutral && typeof r.neutral === 'object' ? (r.neutral as Partial<NeutralVars>) : undefined;
  if (!accent && !neutral) return undefined;
  return { accent, neutral };
}

/**
 * Merge a partial user theme with the defaults. Values that don't match the
 * expected shape fall back to defaults. No migration from old shapes — this
 * project's theme data is ephemeral during development.
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

  return {
    presetId: typeof raw.presetId === 'string' ? raw.presetId : DEFAULT_THEME.presetId,
    neutralId: typeof raw.neutralId === 'string' ? raw.neutralId : DEFAULT_THEME.neutralId,
    mode,
    fontFamily: typeof raw.fontFamily === 'string' ? raw.fontFamily : DEFAULT_THEME.fontFamily,
    fontScale,
    radius,
    overrides: normalizeOverrides(raw.overrides),
  };
}

/**
 * Resolve the effective palette for a theme config given whether the UI
 * should currently render as dark. Layering order:
 *   1. Accent preset's tinted neutrals (the "auto" base)
 *   2. If neutralId is a concrete preset id, replace neutrals with that preset
 *   3. User overrides merge on top (accent and neutral tokens, per-key)
 */
export function resolvePalette(theme: ThemeConfig, isDark: boolean): PaletteVars {
  const preset = getPresetById(theme.presetId);
  const mode = isDark ? preset.dark : preset.light;

  let neutral: NeutralVars = mode.neutral;
  if (theme.neutralId && theme.neutralId !== AUTO_NEUTRAL_ID) {
    const neutralPreset = getNeutralById(theme.neutralId);
    neutral = isDark ? neutralPreset.dark : neutralPreset.light;
  }

  const accent: AccentVars = theme.overrides?.accent
    ? { ...mode.accent, ...theme.overrides.accent }
    : mode.accent;

  const mergedNeutral: NeutralVars = theme.overrides?.neutral
    ? { ...neutral, ...theme.overrides.neutral }
    : neutral;

  return { ...mergedNeutral, ...accent };
}

export function resolveFontStack(theme: ThemeConfig): string {
  return getFontById(theme.fontFamily).stack;
}

export function resolveFontScale(theme: ThemeConfig): number {
  return FONT_SCALE_VALUES[theme.fontScale];
}
