import {
  TYPOGRAPHY_SCALES,
  resolveSiteThemeCss,
  type SiteTheme,
} from '@domains/agency-contract';

/**
 * Build a `<style>` body that defines the site theme's CSS variables in a
 * FOUC-safe way:
 *
 * - `mode: 'light'` — only the light palette goes on `:root`.
 * - `mode: 'dark'` — only the dark palette goes on `:root`.
 * - `mode: 'system'` — light palette on `:root` + dark palette wrapped in
 *   `@media (prefers-color-scheme: dark)`.
 *
 * Visitor override (from the header toggle) is handled by the additional
 * `html[data-theme="light|dark"]` blocks — specificity beats `:root`, so
 * the attribute wins regardless of the site default.
 */
export function buildThemeStyleCss(theme: SiteTheme): string {
  const lightVars = cssBlock(resolveSiteThemeCss(theme, false));
  const darkVars = cssBlock(resolveSiteThemeCss(theme, true));
  const scale = TYPOGRAPHY_SCALES[theme.typography] ?? TYPOGRAPHY_SCALES.standard;
  const rootSize = `html{font-size:${(scale.fontSizeRem * 100).toFixed(2)}%;}`;

  const defaultBlock =
    theme.mode === 'dark'
      ? `:root{${darkVars}}`
      : theme.mode === 'light'
        ? `:root{${lightVars}}`
        : `:root{${lightVars}}@media (prefers-color-scheme: dark){:root{${darkVars}}}`;

  // Visitor override — header toggle sets html[data-theme]. Both variants
  // always ship so the toggle works regardless of the current site default.
  const overrideLight = `html[data-theme="light"]{${lightVars}}`;
  const overrideDark = `html[data-theme="dark"]{${darkVars}}`;

  return `${rootSize}${defaultBlock}${overrideLight}${overrideDark}`;
}

function cssBlock(vars: Record<string, string>): string {
  return Object.entries(vars)
    .map(([k, v]) => `${k}:${v};`)
    .join('');
}

/**
 * No-flash script run before first paint. Reads `site-theme` from
 * localStorage (set by the header toggle) and mirrors it to a
 * `data-theme` attribute on `<html>`. Pure browser code — no imports.
 */
export const NO_FLASH_SCRIPT = `(function(){try{var t=localStorage.getItem('site-theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(_){}})();`;
