import type { SeedSource, SeedFn } from '@packages/database/seeder';

/**
 * Agency domain seed sources. Split by kind so the CLI only ever hands the
 * runner sources matching `--kind`.
 *
 * **No system seeds at domain level today.** Anything load-bearing
 * (package infrastructure) lives in the owning package as `seeds/system.ts`.
 *
 * **Demo seeds live here and only here.** Packages may not ship demo data;
 * the domain wires the app and owns opinionated sample content. See the
 * `feedback_seeds_ownership` rule.
 */
export function agencySystemSeedSources(): SeedSource[] {
  return [];
}

/**
 * Single seed source for the e2e-admin user. Consumed by the agency
 * app's test-hooks reset endpoint, which reseeds a minimal "system +
 * e2e-admin" set rather than the full demo set. Lives outside
 * `agencyDemoSeedSources()` so the test-hooks caller doesn't pull in
 * opinionated demo content (pages, menus) that would conflict with
 * test-created entities.
 */
export function agencyE2eAdminSeedSource(): SeedSource {
  return {
    name: '@domains/agency-api/demo-e2e-admin',
    kind: 'demo',
    load: () => import('./seeds/demo-e2e-admin').then((m) => m.seedDemoE2eAdmin),
  };
}

export function agencyDemoSeedSources(): SeedSource[] {
  const demo = (name: string, load: () => Promise<SeedFn>): SeedSource => ({
    name,
    kind: 'demo',
    load,
  });

  return [
    demo('@domains/agency-api/demo-content', () =>
      import('./seeds/demo-content').then((m) => m.seedDemoContent),
    ),
    demo('@domains/agency-api/demo-page', () =>
      import('./seeds/demo-page').then((m) => m.seedDemoPage),
    ),
    demo('@domains/agency-api/demo-pages', () =>
      import('./seeds/demo-pages').then((m) => m.seedDemoPages),
    ),
    // Menus depend on pages existing (linkType:'page' resolves by slug),
    // so order matters — keep menus after pages.
    demo('@domains/agency-api/demo-menus', () =>
      import('./seeds/demo-menus').then((m) => m.seedDemoMenus),
    ),
    // Bootstraps the e2e-admin user so the e2e suite's globalSetup can
    // log in on a freshly-seeded DB. The same source is also reseeded by
    // the test-hooks reset endpoint, so the pinned-id user survives
    // truncate-and-reseed cycles within a suite run.
    agencyE2eAdminSeedSource(),
  ];
}
