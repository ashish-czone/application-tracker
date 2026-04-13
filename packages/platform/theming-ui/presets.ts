import type { AccentVars, NeutralVars, ThemePreset } from './types';

/**
 * Build a light NeutralVars tinted toward a given hue.
 *
 * `sat` is the tint "intensity" — it becomes the saturation applied to the
 * canvas and filled surface tokens. Text/border tokens use a reduced
 * chroma so they stay legible while still carrying the hue.
 *
 * Tuned so each preset is clearly distinguishable: at sat=30+ the whole
 * app canvas visibly shifts, not just the buttons.
 */
function tintedLight(hue: number, sat: number): NeutralVars {
  const low = Math.max(Math.round(sat * 0.55), 4);
  const fg = Math.min(low + 4, 20);
  return {
    // App canvas — tinted near-white so the page reads as having the hue
    // instead of looking like a flat white sheet.
    background: `${hue} ${sat}% 99%`,
    foreground: `${hue} ${fg}% 10%`,
    // Cards stay crisp white so they pop against the tinted canvas.
    card: '0 0% 100%',
    cardForeground: `${hue} ${fg}% 10%`,
    popover: '0 0% 100%',
    popoverForeground: `${hue} ${fg}% 10%`,
    // Filled surfaces — clearly tinted so buttons, chips, zebra rows all
    // pick up the preset hue.
    secondary: `${hue} ${sat}% 94%`,
    secondaryForeground: `${hue} ${fg}% 14%`,
    muted: `${hue} ${sat}% 94%`,
    mutedForeground: `${hue} ${low}% 44%`,
    border: `${hue} ${Math.round(sat * 0.8)}% 88%`,
    input: `${hue} ${Math.round(sat * 0.8)}% 88%`,
    // Sidebar gets a slightly deeper tint than the main canvas so it reads
    // as its own surface.
    sidebar: `${hue} ${sat}% 97%`,
    sidebarForeground: `${hue} ${fg}% 10%`,
    sidebarBorder: `${hue} ${Math.round(sat * 0.8)}% 90%`,
    sidebarMuted: `${hue} ${low}% 50%`,
    // Content-bg is the canvas behind cards — punching this is the single
    // most effective way to tint the whole app.
    contentBg: `${hue} ${sat}% 97%`,
  };
}

function tintedDark(hue: number, sat: number): NeutralVars {
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
    sidebar: `${hue} ${Math.max(sat - 3, 6)}% 8%`,
    sidebarForeground: `${hue} 30% 98%`,
    sidebarBorder: `${hue} ${low}% 16%`,
    sidebarMuted: `${hue} 20% 62%`,
    contentBg: `${hue} ${sat}% 5%`,
  };
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'default',
    name: 'Default',
    description: 'Balanced violet accent on cool slate.',
    swatch: 'hsl(252 56% 57%)',
    light: {
      accent: {
        primary: '252 56% 57%',
        primaryForeground: '0 0% 100%',
        accent: '252 40% 94%',
        accentForeground: '252 30% 18%',
        ring: '252 56% 57%',
        sidebarAccent: '252 56% 57%',
        sidebarAccentForeground: '0 0% 100%',
      },
      // Default keeps a subtler tint so it still reads as "neutral".
      neutral: tintedLight(240, 12),
    },
    dark: {
      accent: {
        primary: '252 56% 65%',
        primaryForeground: '0 0% 100%',
        accent: '252 30% 22%',
        accentForeground: '252 30% 94%',
        ring: '252 56% 65%',
        sidebarAccent: '252 56% 65%',
        sidebarAccentForeground: '0 0% 100%',
      },
      neutral: tintedDark(240, 22),
    },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    description: 'Deep blue on blue-tinted slate — calm and information-dense.',
    swatch: 'hsl(210 90% 50%)',
    light: {
      accent: {
        primary: '210 90% 48%',
        primaryForeground: '0 0% 100%',
        accent: '210 70% 92%',
        accentForeground: '210 60% 18%',
        ring: '210 90% 48%',
        sidebarAccent: '210 90% 48%',
        sidebarAccentForeground: '0 0% 100%',
      },
      neutral: tintedLight(210, 38),
    },
    dark: {
      accent: {
        primary: '210 90% 62%',
        primaryForeground: '0 0% 100%',
        accent: '210 45% 22%',
        accentForeground: '210 60% 94%',
        ring: '210 90% 62%',
        sidebarAccent: '210 90% 62%',
        sidebarAccentForeground: '0 0% 100%',
      },
      neutral: tintedDark(210, 35),
    },
  },
  {
    id: 'forest',
    name: 'Forest',
    description: 'Grounded green on sage — natural and calming.',
    swatch: 'hsl(142 55% 38%)',
    light: {
      accent: {
        primary: '142 55% 36%',
        primaryForeground: '0 0% 100%',
        accent: '142 45% 90%',
        accentForeground: '145 50% 15%',
        ring: '142 55% 36%',
        sidebarAccent: '142 55% 36%',
        sidebarAccentForeground: '0 0% 100%',
      },
      neutral: tintedLight(142, 32),
    },
    dark: {
      accent: {
        primary: '142 55% 52%',
        primaryForeground: '0 0% 100%',
        accent: '142 30% 20%',
        accentForeground: '142 40% 94%',
        ring: '142 55% 52%',
        sidebarAccent: '142 55% 52%',
        sidebarAccentForeground: '0 0% 100%',
      },
      neutral: tintedDark(142, 28),
    },
  },
  {
    id: 'sunset',
    name: 'Sunset',
    description: 'Warm orange on sand — energetic and welcoming.',
    swatch: 'hsl(22 90% 52%)',
    light: {
      accent: {
        primary: '22 90% 50%',
        primaryForeground: '0 0% 100%',
        accent: '28 80% 92%',
        accentForeground: '22 60% 18%',
        ring: '22 90% 50%',
        sidebarAccent: '22 90% 50%',
        sidebarAccentForeground: '0 0% 100%',
      },
      neutral: tintedLight(28, 36),
    },
    dark: {
      accent: {
        primary: '22 90% 60%',
        primaryForeground: '0 0% 100%',
        accent: '28 40% 22%',
        accentForeground: '28 50% 94%',
        ring: '22 90% 60%',
        sidebarAccent: '22 90% 60%',
        sidebarAccentForeground: '0 0% 100%',
      },
      neutral: tintedDark(28, 32),
    },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'Deep violet on cool purple-slate — built for dark mode.',
    swatch: 'hsl(270 60% 55%)',
    light: {
      accent: {
        primary: '270 60% 55%',
        primaryForeground: '0 0% 100%',
        accent: '270 50% 92%',
        accentForeground: '270 45% 18%',
        ring: '270 60% 55%',
        sidebarAccent: '270 60% 55%',
        sidebarAccentForeground: '0 0% 100%',
      },
      neutral: tintedLight(265, 38),
    },
    dark: {
      accent: {
        primary: '270 65% 67%',
        primaryForeground: '0 0% 100%',
        accent: '265 40% 22%',
        accentForeground: '270 45% 94%',
        ring: '270 65% 67%',
        sidebarAccent: '270 65% 67%',
        sidebarAccentForeground: '0 0% 100%',
      },
      neutral: tintedDark(265, 35),
    },
  },
];

export const DEFAULT_PRESET_ID = 'default';

export function getPresetById(id: string): ThemePreset {
  return THEME_PRESETS.find((p) => p.id === id) ?? THEME_PRESETS[0];
}
