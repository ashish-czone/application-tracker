export type ThemeMode = 'light' | 'dark' | 'system';

/**
 * HSL channel string in "H S% L%" format (no hsl() wrapper), e.g. "252 56% 57%".
 * Matches the CSS custom properties declared in @packages/ui/globals.css.
 */
export type HslChannels = string;

export interface PaletteVars {
  primary: HslChannels;
  primaryForeground: HslChannels;
  accent: HslChannels;
  accentForeground: HslChannels;
  ring: HslChannels;
  sidebarAccent: HslChannels;
  sidebarAccentForeground: HslChannels;
}

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  /** Swatch shown in the picker UI — CSS color or hsl() string. */
  swatch: string;
  light: PaletteVars;
  dark: PaletteVars;
}

export type FontScale = 'sm' | 'md' | 'lg';

export interface ThemeConfig {
  presetId: string;
  mode: ThemeMode;
  fontFamily: string;
  fontScale: FontScale;
  radius: number;
  overrides?: Partial<PaletteVars>;
}

export interface ApiFn {
  get: <T>(path: string) => Promise<T>;
  post: <T>(path: string, body?: unknown) => Promise<T>;
  patch: <T>(path: string, body?: unknown) => Promise<T>;
  put: <T>(path: string, body?: unknown) => Promise<T>;
  delete: <T>(path: string) => Promise<T>;
}
