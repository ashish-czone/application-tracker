import type { SeedSource, SeedFn } from '@packages/database/seeder';

type PkgName =
  | '@packages/rbac'
  | '@packages/auth'
  | '@packages/settings'
  | '@packages/audit'
  | '@packages/notification-channels'
  | '@packages/notifications'
  | '@packages/automations'
  | '@packages/workflows'
  | '@packages/taxonomy'
  | '@packages/user-preferences'
  | '@packages/entity-engine'
  | '@packages/entity-layout'
  | '@packages/hierarchy'
  | '@packages/tenancy'
  | '@packages/eav-attributes'
  | '@packages/entity-relations'
  | '@packages/org-units'
  | '@packages/tasks'
  | '@packages/notes'
  | '@packages/attachments'
  | '@packages/evaluations'
  | '@packages/document-templates'
  | '@packages/orders-billing'
  | '@packages/orders-subscriptions';

/**
 * Ordered list of platform seed sources. Each entry lazy-loads a
 * `seeds/system.ts` or `seeds/demo.ts` module from the owning package.
 *
 * The order mirrors `platformMigrationSources`: anything a later seed
 * depends on (FK refs, lookups) must come first. `@packages/auth` owns
 * users + default roles, so its system seed runs before anything that
 * assigns users to things.
 *
 * Adding a new package seed:
 * 1. Create `packages/<tier>/<name>/api/seeds/system.ts` exporting
 *    `export const seedSystem: SeedFn`, or `seeds/demo.ts` exporting
 *    `export const seedDemo: SeedFn`.
 * 2. Add `"./seeds/system": "./seeds/system.ts"` to the package's
 *    `exports` field.
 * 3. Register a new entry here in the correct dep order.
 */
export function platformSeedSources(): SeedSource[] {
  const system = (name: PkgName, load: () => Promise<{ seedSystem: SeedFn }>): SeedSource => ({
    name,
    kind: 'system',
    load: () => load().then((m) => m.seedSystem),
  });

  // Kept for symmetry with PR 2; currently no platform package ships a
  // demo seed. Enable by importing and adding entries below.
  // const demo = (name: PkgName, load: () => Promise<{ seedDemo: SeedFn }>): SeedSource => ({
  //   name,
  //   kind: 'demo',
  //   load: () => load().then((m) => m.seedDemo),
  // });

  return [
    system('@packages/auth', () => import('@packages/auth/seeds/system')),
  ];
}
