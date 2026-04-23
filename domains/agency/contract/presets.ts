import type { SiteTheme } from './index';

export interface AgencyPalette {
  primary: string;
  primaryForeground: string;
  accent: string;
  accentForeground: string;
  ring: string;
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  input: string;
}

export interface AgencyPreset {
  id: string;
  name: string;
  description: string;
  swatch: string;
  light: AgencyPalette;
  dark: AgencyPalette;
}

function tintedLight(hue: number, sat: number): Pick<AgencyPalette, 'background' | 'foreground' | 'card' | 'cardForeground' | 'popover' | 'popoverForeground' | 'secondary' | 'secondaryForeground' | 'muted' | 'mutedForeground' | 'border' | 'input'> {
  const low = Math.max(Math.round(sat * 0.55), 4);
  const fg = Math.min(low + 4, 20);
  return {
    background: `${hue} ${sat}% 99%`,
    foreground: `${hue} ${fg}% 10%`,
    card: '0 0% 100%',
    cardForeground: `${hue} ${fg}% 10%`,
    popover: '0 0% 100%',
    popoverForeground: `${hue} ${fg}% 10%`,
    secondary: `${hue} ${sat}% 94%`,
    secondaryForeground: `${hue} ${fg}% 14%`,
    muted: `${hue} ${sat}% 94%`,
    mutedForeground: `${hue} ${low}% 44%`,
    border: `${hue} ${Math.round(sat * 0.8)}% 88%`,
    input: `${hue} ${Math.round(sat * 0.8)}% 88%`,
  };
}

function tintedDark(hue: number, sat: number): Pick<AgencyPalette, 'background' | 'foreground' | 'card' | 'cardForeground' | 'popover' | 'popoverForeground' | 'secondary' | 'secondaryForeground' | 'muted' | 'mutedForeground' | 'border' | 'input'> {
  const low = Math.max(Math.round(sat * 0.7), 6);
  return {
    background: `${hue} ${sat}% 6%`,
    foreground: `${hue} 30% 98%`,
    card: `${hue} ${Math.max(sat - 5, 6)}% 10%`,
    cardForeground: `${hue} 30% 98%`,
    popover: `${hue} ${Math.max(sat - 5, 6)}% 10%`,
    popoverForeground: `${hue} 30% 98%`,
    secondary: `${hue} ${low}% 16%`,
    secondaryForeground: `${hue} 30% 98%`,
    muted: `${hue} ${low}% 16%`,
    mutedForeground: `${hue} 20% 68%`,
    border: `${hue} ${low}% 20%`,
    input: `${hue} ${low}% 20%`,
  };
}

function preset(
  id: string,
  name: string,
  description: string,
  accentHue: number,
  accentSat: number,
  accentLum: { light: number; dark: number },
  neutralHue: number,
  neutralSat: number,
): AgencyPreset {
  const lightAccent = `${accentHue} ${accentSat}% ${accentLum.light}%`;
  const darkAccent = `${accentHue} ${accentSat}% ${accentLum.dark}%`;
  return {
    id,
    name,
    description,
    swatch: `hsl(${lightAccent})`,
    light: {
      ...tintedLight(neutralHue, neutralSat),
      primary: lightAccent,
      primaryForeground: '0 0% 100%',
      accent: `${accentHue} ${Math.round(accentSat * 0.8)}% 94%`,
      accentForeground: `${accentHue} ${Math.round(accentSat * 0.6)}% 18%`,
      ring: lightAccent,
    },
    dark: {
      ...tintedDark(neutralHue, neutralSat),
      primary: darkAccent,
      primaryForeground: '0 0% 100%',
      accent: `${accentHue} ${Math.round(accentSat * 0.5)}% 22%`,
      accentForeground: `${accentHue} ${Math.round(accentSat * 0.6)}% 94%`,
      ring: darkAccent,
    },
  };
}

/**
 * Six agency aesthetics — names chosen to communicate intent, not color.
 * Ordered from most restrained (Minimal) to most distinctive (Monochrome).
 */
export const AGENCY_PRESETS: AgencyPreset[] = [
  preset('minimal', 'Minimal', 'Restrained neutral with a single indigo accent.', 232, 75, { light: 58, dark: 65 }, 230, 8),
  preset('bold', 'Bold', 'High-contrast electric blue on crisp neutrals.', 210, 92, { light: 48, dark: 62 }, 210, 12),
  preset('editorial', 'Editorial', 'Warm ivory canvas with a deep clay accent.', 18, 72, { light: 44, dark: 58 }, 28, 24),
  preset('studio-dark', 'Studio Dark', 'Built for dark mode — muted violet on charcoal.', 262, 58, { light: 55, dark: 68 }, 260, 22),
  preset('warm', 'Warm', 'Soft sunset orange on a muted peach ground.', 22, 88, { light: 52, dark: 62 }, 28, 30),
  preset('monochrome', 'Monochrome', 'Pure neutral with jet-black accents.', 0, 0, { light: 10, dark: 92 }, 0, 0),
];

export const DEFAULT_AGENCY_PRESET_ID = 'minimal';

export function getAgencyPreset(id: string): AgencyPreset {
  return AGENCY_PRESETS.find((p) => p.id === id) ?? AGENCY_PRESETS[0];
}

/**
 * Named typography scales. Exposed as a CSS root font-size multiplier (1 = 16px base)
 * and a font-stack. The customer portal's fluid type already uses `clamp()` against
 * root em, so scaling the root multiplies every text size proportionally.
 */
export const TYPOGRAPHY_SCALES = {
  compact: { fontSizeRem: 0.9375, label: 'Compact', description: 'Denser — fits more content above the fold.' },
  standard: { fontSizeRem: 1, label: 'Standard', description: 'Balanced reading rhythm.' },
  editorial: { fontSizeRem: 1.0625, label: 'Editorial', description: 'Larger body text for long-form pages.' },
} as const;

export type TypographyScale = keyof typeof TYPOGRAPHY_SCALES;

/**
 * Resolve a stored SiteTheme into a CSS-variable map suitable for inline
 * `<style>` injection. Pure and framework-free — runs both on the admin
 * portal (Vite/React) and the customer portal (Next.js SSR).
 */
export function resolveSiteThemeCss(theme: SiteTheme, isDark: boolean): Record<string, string> {
  const presetObj = getAgencyPreset(theme.presetId);
  const palette = isDark ? presetObj.dark : presetObj.light;

  const primary = theme.accentOverride ?? palette.primary;
  const ring = theme.accentOverride ?? palette.ring;

  return {
    '--primary': primary,
    '--primary-foreground': palette.primaryForeground,
    '--accent': palette.accent,
    '--accent-foreground': palette.accentForeground,
    '--ring': ring,
    '--background': palette.background,
    '--foreground': palette.foreground,
    '--card': palette.card,
    '--card-foreground': palette.cardForeground,
    '--popover': palette.popover,
    '--popover-foreground': palette.popoverForeground,
    '--secondary': palette.secondary,
    '--secondary-foreground': palette.secondaryForeground,
    '--muted': palette.muted,
    '--muted-foreground': palette.mutedForeground,
    '--border': palette.border,
    '--input': palette.input,
    '--radius': `${theme.radius}rem`,
  };
}

/**
 * Whether the given theme should render as dark for a browser environment.
 * "system" only returns true when called with an explicit isSystemDark hint —
 * SSR callers should pass `false` and let the client hydrate with matchMedia.
 */
export function isSiteThemeDark(theme: SiteTheme, isSystemDark: boolean): boolean {
  if (theme.mode === 'dark') return true;
  if (theme.mode === 'light') return false;
  return isSystemDark;
}
