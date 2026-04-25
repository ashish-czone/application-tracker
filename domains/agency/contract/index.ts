/**
 * Public, serializable shape of the agency site theme.
 *
 * Stored as jsonb under the `site.theme` settings key. Mirrors the structural
 * fields of `ThemeConfig` in `@packages/theming-ui` but intentionally does not
 * import from it — backend + Next.js customer portal consume this without
 * pulling the React package.
 *
 * Runtime shape is validated at the boundary (admin settings API for writes,
 * Next.js portal `normalizeSiteTheme()` for reads).
 */
export interface SiteTheme {
  /** Preset id. Agency presets live in the admin portal's preset registry. */
  presetId: string;
  /** Neutral preset id, or the sentinel "auto" (use preset's own tinted neutrals). */
  neutralId: string;
  /** Default mode when the visitor hasn't overridden via the header toggle. */
  mode: 'light' | 'dark' | 'system';
  /** Font family id (must match a font registered in the customer portal). */
  fontFamily: string;
  /** Named typography scale. */
  typography: 'compact' | 'standard' | 'editorial';
  /** Corner radius in rem (0 = square, ~1 = pill). */
  radius: number;
  /** Optional accent override — HSL channels "H S% L%", or null to use preset accent. */
  accentOverride: string | null;
}

export const DEFAULT_SITE_THEME: SiteTheme = {
  presetId: 'minimal',
  neutralId: 'auto',
  mode: 'system',
  fontFamily: 'plus-jakarta-sans',
  typography: 'standard',
  radius: 0.625,
  accentOverride: null,
};

export {
  AGENCY_PRESETS,
  DEFAULT_AGENCY_PRESET_ID,
  TYPOGRAPHY_SCALES,
  getAgencyPreset,
  resolveSiteThemeCss,
  isSiteThemeDark,
} from './presets';
export type { AgencyPreset, AgencyPalette, TypographyScale } from './presets';

export * from './blocks';
