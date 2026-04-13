import type { NeutralPreset, NeutralVars } from './types';

/**
 * Sentinel value for "use the accent preset's own tinted neutrals".
 * When theme.neutralId === AUTO_NEUTRAL_ID, the resolver keeps whatever
 * neutrals the accent preset shipped, rather than overriding them.
 */
export const AUTO_NEUTRAL_ID = 'auto';

/**
 * Shared foreground tones reused across neutral presets. Dark mode uses a
 * near-white for body text; light mode uses a near-black with a hint of hue.
 */
function buildLight(hue: number, chroma: number): NeutralVars {
  return {
    background: '0 0% 100%',
    foreground: `${hue} ${Math.min(chroma + 2, 12)}% 10%`,
    card: '0 0% 100%',
    cardForeground: `${hue} ${Math.min(chroma + 2, 12)}% 10%`,
    popover: '0 0% 100%',
    popoverForeground: `${hue} ${Math.min(chroma + 2, 12)}% 10%`,
    secondary: `${hue} ${chroma}% 96%`,
    secondaryForeground: `${hue} ${Math.min(chroma + 2, 12)}% 10%`,
    muted: `${hue} ${chroma}% 96%`,
    mutedForeground: `${hue} ${Math.max(chroma - 1, 3)}% 46%`,
    border: `${hue} ${chroma}% 90%`,
    input: `${hue} ${chroma}% 90%`,
    sidebar: `${hue} ${chroma}% 99%`,
    sidebarForeground: `${hue} ${Math.min(chroma + 2, 12)}% 10%`,
    sidebarBorder: `${hue} ${chroma}% 93%`,
    sidebarMuted: `${hue} ${Math.max(chroma - 2, 3)}% 55%`,
    contentBg: `${hue} ${chroma + 3}% 98%`,
  };
}

function buildDark(hue: number, chroma: number): NeutralVars {
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

/**
 * Five neutral families, modeled after shadcn/Tailwind's neutral ramps.
 * Users can pick one independently of the accent preset, or keep 'auto' to
 * inherit whatever neutrals the accent preset ships with.
 */
export const NEUTRAL_PRESETS: NeutralPreset[] = [
  {
    id: 'slate',
    name: 'Slate',
    description: 'Cool blue-grey. The platform default.',
    swatch: 'hsl(215 20% 65%)',
    light: buildLight(215, 16),
    dark: buildDark(222, 7),
  },
  {
    id: 'gray',
    name: 'Gray',
    description: 'True neutral grey with no hue cast.',
    swatch: 'hsl(220 9% 60%)',
    light: buildLight(220, 6),
    dark: buildDark(220, 2),
  },
  {
    id: 'zinc',
    name: 'Zinc',
    description: 'Slightly warmer than gray, industrial feel.',
    swatch: 'hsl(240 4% 60%)',
    light: buildLight(240, 4),
    dark: buildDark(240, 2),
  },
  {
    id: 'neutral',
    name: 'Neutral',
    description: 'Pure neutral — no hue, lowest saturation.',
    swatch: 'hsl(0 0% 60%)',
    light: buildLight(0, 0),
    dark: buildDark(0, 0),
  },
  {
    id: 'stone',
    name: 'Stone',
    description: 'Warm earth tone with a subtle beige cast.',
    swatch: 'hsl(30 6% 60%)',
    light: buildLight(30, 6),
    dark: buildDark(30, 2),
  },
];

export const DEFAULT_NEUTRAL_ID = 'slate';

/**
 * Return the neutral preset matching the id. Returns the default preset if
 * the id is unknown or if the id is AUTO_NEUTRAL_ID — callers that care
 * about 'auto' should check before calling this.
 */
export function getNeutralById(id: string): NeutralPreset {
  return (
    NEUTRAL_PRESETS.find((n) => n.id === id) ??
    NEUTRAL_PRESETS.find((n) => n.id === DEFAULT_NEUTRAL_ID) ??
    NEUTRAL_PRESETS[0]
  );
}
