import type { Config } from 'tailwindcss';
import baseConfig from '../../packages/core/ui/tailwind.config';

const config: Config = {
  ...baseConfig,
  content: [
    './src/**/*.{ts,tsx}',
    // Scan UI source by the real package layout — the same way Vite resolves @packages/*-ui
    // aliases (see packages/resolve-aliases.ts) — instead of a hand-maintained per-folder list.
    // The previous explicit list silently rotted: ~18 entries pointed at paths that no longer
    // exist (e.g. `platform/app-shell-ui` — the package actually lives at `platform/app-shell/ui`),
    // so those packages' Tailwind classes were purged from the bundle. The app-shell sidebar
    // offset (`lg:pl-60`) was a casualty, which made page content render *under* the fixed sidebar.
    //
    // Two layout conventions coexist and both are matched: nested `<feature>/ui/` (app-shell,
    // entity-engine, notes, …) and flat `<feature>-ui/` (platform-ui, eav-attributes-ui).
    // Scoping to `ui` / `*-ui` dirs keeps backend `api/` source out of the scan; Tailwind
    // ignores node_modules by default.
    '../../packages/{core,platform,addons}/**/ui/**/*.{ts,tsx}',
    '../../packages/{core,platform,addons}/*-ui/**/*.{ts,tsx}',
    '../../domains/*/ui/**/*.{ts,tsx}',
  ],
};

export default config;
