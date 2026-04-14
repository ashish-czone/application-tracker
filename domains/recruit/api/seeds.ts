import type { SeedSource, SeedFn } from '@packages/database/seeder';

/**
 * Recruit domain seed sources, split by kind. The cli picks the
 * matching set based on `--kind` so the runner never sees sources
 * of the wrong kind.
 *
 * **No system seeds at domain level today.** Anything load-bearing
 * (package infrastructure) lives inside the owning package as
 * `seeds/system.ts`. If a recruit-specific system seed ever does
 * appear here, it should be rare — the default home is the package.
 *
 * **Demo seeds live here and only here.** Packages may not ship
 * demo data; the domain wires the app together and owns opinionated
 * sample content. See the `feedback_seeds_ownership` rule.
 */
export function recruitSystemSeedSources(): SeedSource[] {
  return [];
}

export function recruitDemoSeedSources(): SeedSource[] {
  const demo = (name: string, load: () => Promise<SeedFn>): SeedSource => ({
    name,
    kind: 'demo',
    load,
  });

  return [
    demo('@domains/recruit-api/countries', () =>
      import('./shared/seeds/countries').then((m) => m.seedCountries),
    ),
    demo('@domains/recruit-api/taxonomy', () =>
      import('./shared/seeds/taxonomy').then((m) => m.seedTaxonomy),
    ),
    demo('@domains/recruit-api/demo-org', () =>
      import('./shared/seeds/demo-org').then((m) => m.seedDemoOrg),
    ),
    demo('@domains/recruit-api/demo-candidates', () =>
      import('./candidates/seeds/demo-candidates').then((m) => m.seedDemoCandidates),
    ),
    demo('@domains/recruit-api/demo-job-openings', () =>
      import('./job-openings/seeds/demo-job-openings').then((m) => m.seedDemoJobOpenings),
    ),
    demo('@domains/recruit-api/demo-clients', () =>
      import('./clients/seeds/demo-clients').then((m) => m.seedDemoClients),
    ),
    demo('@domains/recruit-api/demo-task-tags', () =>
      import('./tasks/seeds/demo-task-tags').then((m) => m.seedDemoTaskTags),
    ),
    demo('@domains/recruit-api/demo-automations', () =>
      import('./applications/seeds/demo-automations').then((m) => m.seedDemoAutomations),
    ),
  ];
}
