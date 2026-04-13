import { resolveFontScale, resolveFontStack, resolvePalette } from './theme-config';
import type { PaletteVars, ThemeConfig } from './types';

const PALETTE_VAR_MAP: Record<string, (p: PaletteVars) => string> = {
  // Accent tokens
  '--primary': (p) => p.primary,
  '--primary-foreground': (p) => p.primaryForeground,
  '--accent': (p) => p.accent,
  '--accent-foreground': (p) => p.accentForeground,
  '--ring': (p) => p.ring,
  '--sidebar-accent': (p) => p.sidebarAccent,
  '--sidebar-accent-foreground': (p) => p.sidebarAccentForeground,
  // Neutral tokens
  '--background': (p) => p.background,
  '--foreground': (p) => p.foreground,
  '--card': (p) => p.card,
  '--card-foreground': (p) => p.cardForeground,
  '--popover': (p) => p.popover,
  '--popover-foreground': (p) => p.popoverForeground,
  '--secondary': (p) => p.secondary,
  '--secondary-foreground': (p) => p.secondaryForeground,
  '--muted': (p) => p.muted,
  '--muted-foreground': (p) => p.mutedForeground,
  '--border': (p) => p.border,
  '--input': (p) => p.input,
  '--sidebar': (p) => p.sidebar,
  '--sidebar-foreground': (p) => p.sidebarForeground,
  '--sidebar-border': (p) => p.sidebarBorder,
  '--sidebar-muted': (p) => p.sidebarMuted,
  '--content-bg': (p) => p.contentBg,
};

/**
 * Decide whether the document should currently render as dark given the
 * user's preferred mode. "system" defers to the OS via matchMedia.
 */
export function isDarkMode(theme: ThemeConfig): boolean {
  if (theme.mode === 'dark') return true;
  if (theme.mode === 'light') return false;
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Write the theme to the document root: toggles .dark, writes CSS custom
 * properties, sets body font + root font-size. Safe to call repeatedly —
 * each call fully replaces the previous state.
 */
export function applyThemeToDom(theme: ThemeConfig, doc: Document = document): void {
  const root = doc.documentElement;
  const dark = isDarkMode(theme);

  if (dark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  const palette = resolvePalette(theme, dark);
  for (const [cssVar, read] of Object.entries(PALETTE_VAR_MAP)) {
    root.style.setProperty(cssVar, read(palette));
  }
  root.style.setProperty('--radius', `${theme.radius}rem`);

  root.style.setProperty('font-size', `${resolveFontScale(theme) * 100}%`);

  if (doc.body) {
    doc.body.style.fontFamily = resolveFontStack(theme);
  }
}

/**
 * Remove all theme-applied inline styles from the document root, returning
 * the page to whatever globals.css declared. Used on provider unmount and
 * when toggling themes in tests.
 */
export function resetThemeDom(doc: Document = document): void {
  const root = doc.documentElement;
  for (const cssVar of Object.keys(PALETTE_VAR_MAP)) {
    root.style.removeProperty(cssVar);
  }
  root.style.removeProperty('--radius');
  root.style.removeProperty('font-size');
  if (doc.body) {
    doc.body.style.removeProperty('font-family');
  }
}
