// @ts-check
/**
 * Boundary-only ESLint flat config. Enforces the tier rules from
 * .claude/rules/dependency-direction.md:
 *
 *   apps/*              →  packages/{core,platform,addons}/* + domains/*
 *   domains/*           →  packages/{core,platform,addons}/*  (never domains, never apps)
 *   packages/addons/*   →  packages/{core,platform,addons}/*  (addon → addon allowed)
 *   packages/platform/* →  packages/core/* + platform          (never addons)
 *   platform/app-shell  →  packages/{core,platform,addons}/*  (integrator exception)
 *   packages/core/*     →  core only                           (never platform, addons, domains, apps)
 *
 * Invoked by `pnpm lint`. Runs independently of the main ESLint config so
 * pre-existing style issues in the repo don't mask boundary violations.
 */
import boundaries from 'eslint-plugin-boundaries';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/*.d.ts',
      '**/*.js',
      '**/*.cjs',
      '**/*.mjs',
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.spec.ts',
      '**/*.spec.tsx',
    ],
  },
  {
    files: ['apps/**/*.{ts,tsx}', 'packages/**/*.{ts,tsx}', 'domains/**/*.{ts,tsx}'],
    linterOptions: {
      // These come from eslint-disable directives in source that reference
      // rules from the full config (not loaded here). Silence them.
      reportUnusedDisableDirectives: 'off',
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      boundaries,
      // Registered as no-ops so pre-existing `eslint-disable-next-line <rule>`
      // comments in source files don't trip the boundary-only config.
      '@typescript-eslint': tsPlugin,
      'react-hooks': reactHooks,
    },
    settings: {
      'boundaries/include': [
        'apps/**/*',
        'packages/**/*',
        'domains/**/*',
      ],
      'boundaries/elements': [
        { type: 'core',              pattern: 'packages/core/*',              mode: 'folder' },
        // app-shell is the integrator — declared before the generic platform
        // pattern so files inside it match this type and pick up the broader
        // allow list below.
        { type: 'platform-app-shell', pattern: 'packages/platform/app-shell',  mode: 'folder' },
        { type: 'platform',          pattern: 'packages/platform/*',          mode: 'folder' },
        { type: 'addon',             pattern: 'packages/addons/*',            mode: 'folder' },
        { type: 'domain',            pattern: 'domains/*/*',                  mode: 'folder' },
        { type: 'app',               pattern: 'apps/*',                       mode: 'folder' },
      ],
    },
    rules: {
      // Using legacy rule name to match plugin v5 selector syntax.
      // v6 renames this to `boundaries/dependencies` with a new object schema;
      // migrate when the ecosystem stabilizes.
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            { from: ['core'],              allow: ['core'] },
            { from: ['platform'],          allow: ['core', 'platform'] },
            { from: ['platform-app-shell'], allow: ['core', 'platform', 'addon'] },
            { from: ['addon'],             allow: ['core', 'platform', 'addon'] },
            { from: ['domain'],            allow: ['core', 'platform', 'addon'] },
            { from: ['app'],               allow: ['core', 'platform', 'platform-app-shell', 'addon', 'domain'] },
          ],
        },
      ],
    },
  },
  // api ↔ ui boundary: api packages must not import from ui packages.
  // The api layer ships zero presentation; UI metadata lives only on the
  // frontend `EntityUIConfig`. See PROMPT-API.md §15 and PROMPT-UI.md §16.
  {
    files: ['packages/*/*/api/**/*.{ts,tsx}', 'domains/*/api/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@packages/ui', '@packages/ui/**'],
              message:
                'api packages must not import from @packages/ui — UI primitives belong on the frontend only.',
            },
            {
              group: ['@packages/*-ui', '@packages/*-ui/**'],
              message:
                'api packages must not import from any @packages/*-ui package — presentation lives on the frontend `EntityUIConfig`.',
            },
          ],
        },
      ],
    },
  },
];
