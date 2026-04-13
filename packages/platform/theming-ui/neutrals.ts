import type { NeutralPreset, NeutralVars } from './types';

/**
 * Sentinel value for "use the accent preset's own tinted neutrals".
 * When theme.neutralId === AUTO_NEUTRAL_ID, the resolver keeps whatever
 * neutrals the accent preset shipped, rather than overriding them.
 */
export const AUTO_NEUTRAL_ID = 'auto';

/**
 * Build a light NeutralVars ramp tinted toward a given hue.
 *
 * `sat` drives how saturated the whole ramp is. Neutrals are inherently
 * low-saturation (that's what makes them "neutral"), but we keep enough
 * chroma that the family is distinguishable from its neighbours.
 */
function buildLight(hue: number, sat: number): NeutralVars {
  const low = Math.max(Math.round(sat * 0.6), 3);
  const fg = Math.min(low + 4, 18);
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
    sidebar: `${hue} ${sat}% 97%`,
    sidebarForeground: `${hue} ${fg}% 10%`,
    sidebarBorder: `${hue} ${Math.round(sat * 0.8)}% 90%`,
    sidebarMuted: `${hue} ${low}% 50%`,
    contentBg: `${hue} ${sat}% 97%`,
  };
}

function buildDark(hue: number, sat: number): NeutralVars {
  const low = Math.max(Math.round(sat * 0.7), 5);
  return {
    background: `${hue} ${sat}% 6%`,
    foreground: `${hue} 30% 98%`,
    card: `${hue} ${Math.max(sat - 4, 5)}% 10%`,
    cardForeground: `${hue} 30% 98%`,
    popover: `${hue} ${Math.max(sat - 4, 5)}% 10%`,
    popoverForeground: `${hue} 30% 98%`,
    secondary: `${hue} ${low}% 16%`,
    secondaryForeground: `${hue} 30% 98%`,
    muted: `${hue} ${low}% 16%`,
    mutedForeground: `${hue} 20% 68%`,
    border: `${hue} ${low}% 20%`,
    input: `${hue} ${low}% 20%`,
    sidebar: `${hue} ${Math.max(sat - 3, 5)}% 8%`,
    sidebarForeground: `${hue} 30% 98%`,
    sidebarBorder: `${hue} ${low}% 16%`,
    sidebarMuted: `${hue} 20% 62%`,
    contentBg: `${hue} ${sat}% 5%`,
  };
}

/**
 * Five neutral families, modeled after shadcn/Tailwind's neutral ramps.
 * Sat values are chosen so each family is visibly distinct from the others
 * and from pure grey, while still reading as "neutral".
 */
export const NEUTRAL_PRESETS: NeutralPreset[] = [
  {
    id: 'slate',
    name: 'Slate',
    description: 'Cool blue-grey. The platform default.',
    swatch: 'hsl(215 25% 60%)',
    light: buildLight(215, 22),
    dark: buildDark(222, 28),
  },
  {
    id: 'gray',
    name: 'Gray',
    description: 'True neutral grey with a subtle cool cast.',
    swatch: 'hsl(220 9% 60%)',
    light: buildLight(220, 10),
    dark: buildDark(220, 14),
  },
  {
    id: 'zinc',
    name: 'Zinc',
    description: 'Industrial grey, slightly warmer than gray.',
    swatch: 'hsl(240 6% 60%)',
    light: buildLight(240, 8),
    dark: buildDark(240, 12),
  },
  {
    id: 'neutral',
    name: 'Neutral',
    description: 'Pure neutral — no hue at all.',
    swatch: 'hsl(0 0% 60%)',
    light: buildLight(0, 0),
    dark: buildDark(0, 0),
  },
  {
    id: 'stone',
    name: 'Stone',
    description: 'Warm earth tone with a subtle beige cast.',
    swatch: 'hsl(28 18% 60%)',
    light: buildLight(28, 18),
    dark: buildDark(28, 16),
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
