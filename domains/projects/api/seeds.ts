import type { SeedSource, SeedFn } from '@packages/database/seeder';

/**
 * Projects domain seed sources, split by kind.
 *
 * **No system seeds today.** All load-bearing infrastructure (workflow rows
 * for project/milestone/feature/task status fields) is auto-registered by
 * `EntityEngineModule.forEntity()` against `adminConfigurable: true` configs.
 *
 * **Demo seeds** populate three opinionated sample projects with milestones,
 * features, and tasks across various statuses so the dashboard, project
 * detail, and My Tasks pages have something realistic to render on a fresh
 * install. Packages may not ship demo data — domains own it.
 */

const demo = (name: string, load: () => Promise<SeedFn>): SeedSource => ({
  name,
  kind: 'demo',
  load,
});

export function projectsSystemSeedSources(): SeedSource[] {
  return [];
}

export function projectsDemoSeedSources(): SeedSource[] {
  return [
    demo('@domains/projects-api/demo-projects', () =>
      import('./seeds/demo-projects').then((m) => m.seedDemoProjects),
    ),
  ];
}
