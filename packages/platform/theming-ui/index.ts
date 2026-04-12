export { ThemeProvider, useTheme } from './ThemeProvider';
export { THEME_PRESETS, DEFAULT_PRESET_ID, getPresetById } from './presets';
export { CURATED_FONTS, DEFAULT_FONT_ID, getFontById, FONT_SCALE_VALUES } from './fonts';
export { DEFAULT_THEME, normalizeTheme, resolvePalette, resolveFontStack, resolveFontScale } from './theme-config';
export { applyThemeToDom, resetThemeDom, isDarkMode } from './css-vars';
export { createThemingApi, THEMING_NAMESPACE, THEME_PREFERENCE_KEY, type ThemingApi } from './services';
export type {
  ThemeConfig,
  ThemeMode,
  ThemePreset,
  PaletteVars,
  FontScale,
  HslChannels,
  ApiFn,
} from './types';
export type { CuratedFont } from './fonts';
