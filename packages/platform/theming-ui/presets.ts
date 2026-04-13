import type { AccentVars, NeutralVars, ThemePreset } from './types';

/**
 * Build a light NeutralVars tinted toward a given hue. Chroma controls how
 * strongly the hue tints the neutrals — 0 is pure grey, ~12 is clearly tinted.
 */
function tintedLight(hue: number, chroma: number): NeutralVars {
  return {
    background: '0 0% 100%',
    foreground: `${hue} ${Math.min(chroma + 2, 14)}% 10%`,
    card: '0 0% 100%',
    cardForeground: `${hue} ${Math.min(chroma + 2, 14)}% 10%`,
    popover: '0 0% 100%',
    popoverForeground: `${hue} ${Math.min(chroma + 2, 14)}% 10%`,
    secondary: `${hue} ${chroma}% 96%`,
    secondaryForeground: `${hue} ${Math.min(chroma + 2, 14)}% 10%`,
    muted: `${hue} ${chroma}% 96%`,
    mutedForeground: `${hue} ${Math.max(chroma - 1, 3)}% 46%`,
    border: `${hue} ${chroma}% 90%`,
    input: `${hue} ${chroma}% 90%`,
    sidebar: `${hue} ${chroma}% 99%`,
    sidebarForeground: `${hue} ${Math.min(chroma + 2, 14)}% 10%`,
    sidebarBorder: `${hue} ${chroma}% 93%`,
    sidebarMuted: `${hue} ${Math.max(chroma - 2, 3)}% 55%`,
    contentBg: `${hue} ${chroma + 3}% 98%`,
  };
}

function tintedDark(hue: number, chroma: number): NeutralVars {
  return {
    background: `${hue} ${chroma + 40}% 6%`,
    foreground: `${hue} 40% 98%`,
    card: `${hue} ${chroma + 40}% 9%`,
    cardForeground: `${hue} 40% 98%`,
    popover: `${hue} ${chroma + 40}% 9%`,
    popoverForeground: `${hue} 40% 98%`,
    secondary: `${hue} ${chroma + 26}% 15%`,
    secondaryForeground: `${hue} 40% 98%`,
    muted: `${hue} ${chroma + 26}% 15%`,
    mutedForeground: `${hue} 20% 65%`,
    border: `${hue} ${chroma + 26}% 18%`,
    input: `${hue} ${chroma + 26}% 18%`,
    sidebar: `${hue} ${chroma + 40}% 8%`,
    sidebarForeground: `${hue} 40% 98%`,
    sidebarBorder: `${hue} ${chroma + 26}% 15%`,
    sidebarMuted: `${hue} 20% 60%`,
    contentBg: `${hue} ${chroma + 40}% 5%`,
  };
}

const defaultAccentLight: AccentVars = {
  primary: '252 56% 57%',
  primaryForeground: '0 0% 100%',
  accent: '240 5% 96%',
  accentForeground: '240 6% 10%',
  ring: '252 56% 57%',
  sidebarAccent: '252 56% 57%',
  sidebarAccentForeground: '0 0% 100%',
};

const defaultAccentDark: AccentVars = {
  primary: '252 56% 65%',
  primaryForeground: '0 0% 100%',
  accent: '217 33% 18%',
  accentForeground: '210 40% 98%',
  ring: '252 56% 65%',
  sidebarAccent: '252 56% 65%',
  sidebarAccentForeground: '0 0% 100%',
};

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'default',
    name: 'Default',
    description: 'Balanced violet accent on cool slate.',
    swatch: 'hsl(252 56% 57%)',
    light: {
      accent: defaultAccentLight,
      neutral: tintedLight(240, 6),
    },
    dark: {
      accent: defaultAccentDark,
      neutral: tintedDark(222, 7),
    },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    description: 'Calm blue on blue-tinted slate — great for data-heavy screens.',
    swatch: 'hsl(210 90% 50%)',
    light: {
      accent: {
        primary: '210 90% 50%',
        primaryForeground: '0 0% 100%',
        accent: '210 40% 96%',
        accentForeground: '210 50% 15%',
        ring: '210 90% 50%',
        sidebarAccent: '210 90% 50%',
        sidebarAccentForeground: '0 0% 100%',
      },
      neutral: tintedLight(210, 14),
    },
    dark: {
      accent: {
        primary: '210 90% 60%',
        primaryForeground: '0 0% 100%',
        accent: '215 30% 18%',
        accentForeground: '210 40% 98%',
        ring: '210 90% 60%',
        sidebarAccent: '210 90% 60%',
        sidebarAccentForeground: '0 0% 100%',
      },
      neutral: tintedDark(215, 12),
    },
  },
  {
    id: 'forest',
    name: 'Forest',
    description: 'Grounded green against warm stone.',
    swatch: 'hsl(142 55% 38%)',
    light: {
      accent: {
        primary: '142 55% 38%',
        primaryForeground: '0 0% 100%',
        accent: '140 20% 94%',
        accentForeground: '145 25% 15%',
        ring: '142 55% 38%',
        sidebarAccent: '142 55% 38%',
        sidebarAccentForeground: '0 0% 100%',
      },
      neutral: tintedLight(140, 10),
    },
    dark: {
      accent: {
        primary: '142 55% 50%',
        primaryForeground: '0 0% 100%',
        accent: '150 20% 18%',
        accentForeground: '140 20% 94%',
        ring: '142 55% 50%',
        sidebarAccent: '142 55% 50%',
        sidebarAccentForeground: '0 0% 100%',
      },
      neutral: tintedDark(150, 8),
    },
  },
  {
    id: 'sunset',
    name: 'Sunset',
    description: 'Warm orange on warm stone.',
    swatch: 'hsl(22 90% 52%)',
    light: {
      accent: {
        primary: '22 90% 52%',
        primaryForeground: '0 0% 100%',
        accent: '30 30% 94%',
        accentForeground: '25 35% 15%',
        ring: '22 90% 52%',
        sidebarAccent: '22 90% 52%',
        sidebarAccentForeground: '0 0% 100%',
      },
      neutral: tintedLight(30, 12),
    },
    dark: {
      accent: {
        primary: '22 90% 60%',
        primaryForeground: '0 0% 100%',
        accent: '25 25% 18%',
        accentForeground: '30 30% 94%',
        ring: '22 90% 60%',
        sidebarAccent: '22 90% 60%',
        sidebarAccentForeground: '0 0% 100%',
      },
      neutral: tintedDark(25, 10),
    },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'Deep violet on cool purple-slate — made for dark mode.',
    swatch: 'hsl(270 60% 55%)',
    light: {
      accent: {
        primary: '270 60% 55%',
        primaryForeground: '0 0% 100%',
        accent: '270 30% 95%',
        accentForeground: '270 35% 15%',
        ring: '270 60% 55%',
        sidebarAccent: '270 60% 55%',
        sidebarAccentForeground: '0 0% 100%',
      },
      neutral: tintedLight(265, 14),
    },
    dark: {
      accent: {
        primary: '270 65% 65%',
        primaryForeground: '0 0% 100%',
        accent: '260 30% 18%',
        accentForeground: '270 30% 95%',
        ring: '270 65% 65%',
        sidebarAccent: '270 65% 65%',
        sidebarAccentForeground: '0 0% 100%',
      },
      neutral: tintedDark(260, 12),
    },
  },
];

export const DEFAULT_PRESET_ID = 'default';

export function getPresetById(id: string): ThemePreset {
  return THEME_PRESETS.find((p) => p.id === id) ?? THEME_PRESETS[0];
}
