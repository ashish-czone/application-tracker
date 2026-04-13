export type ThemeMode = 'light' | 'dark' | 'system';

/**
 * HSL channel string in "H S% L%" format (no hsl() wrapper), e.g. "252 56% 57%".
 * Matches the CSS custom properties declared in @packages/ui/globals.css.
 */
export type HslChannels = string;

/**
 * Accent / decorative tokens. Changed by accent presets and by the user's
 * custom-accent override.
 */
export interface AccentVars {
  primary: HslChannels;
  primaryForeground: HslChannels;
  accent: HslChannels;
  accentForeground: HslChannels;
  ring: HslChannels;
  sidebarAccent: HslChannels;
  sidebarAccentForeground: HslChannels;
}

/**
 * Base / neutral tokens. Changed by the neutral preset (or the preset's own
 * tinted default when `neutralId` is 'auto').
 */
export interface NeutralVars {
  background: HslChannels;
  foreground: HslChannels;
  card: HslChannels;
  cardForeground: HslChannels;
  popover: HslChannels;
  popoverForeground: HslChannels;
  secondary: HslChannels;
  secondaryForeground: HslChannels;
  muted: HslChannels;
  mutedForeground: HslChannels;
  border: HslChannels;
  input: HslChannels;
  sidebar: HslChannels;
  sidebarForeground: HslChannels;
  sidebarBorder: HslChannels;
  sidebarMuted: HslChannels;
  contentBg: HslChannels;
}

/** Combined effective palette written to the DOM. */
export interface PaletteVars extends AccentVars, NeutralVars {}

/** Light/dark pair covering both accent and neutral tokens. */
export interface PaletteMode {
  accent: AccentVars;
  neutral: NeutralVars;
}

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  /** Swatch shown in the picker UI — CSS color or hsl() string. */
  swatch: string;
  light: PaletteMode;
  dark: PaletteMode;
}

export interface NeutralPreset {
  id: string;
  name: string;
  description: string;
  /** Swatch shown in the picker UI — CSS color or hsl() string. */
  swatch: string;
  light: NeutralVars;
  dark: NeutralVars;
}

export type FontScale = 'sm' | 'md' | 'lg';

export interface ThemeOverrides {
  accent?: Partial<AccentVars>;
  neutral?: Partial<NeutralVars>;
}

export interface ThemeConfig {
  presetId: string;
  /**
   * 'auto' (default) — use the accent preset's own tinted neutrals.
   * Otherwise, a neutral preset id (slate/gray/zinc/neutral/stone).
   */
  neutralId: string;
  mode: ThemeMode;
  fontFamily: string;
  fontScale: FontScale;
  radius: number;
  overrides?: ThemeOverrides;
}

export interface ApiFn {
  get: <T>(path: string) => Promise<T>;
  post: <T>(path: string, body?: unknown) => Promise<T>;
  patch: <T>(path: string, body?: unknown) => Promise<T>;
  put: <T>(path: string, body?: unknown) => Promise<T>;
  delete: <T>(path: string) => Promise<T>;
}
