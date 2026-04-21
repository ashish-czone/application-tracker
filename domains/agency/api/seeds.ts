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
  ];
}
