import type { SeedSource, SeedFn } from '@packages/database/seeder';

type PkgName = '@packages/auth' | '@packages/org-units';

/**
 * Ordered list of platform **system** seed sources. Each entry lazy-loads
 * a `seeds/system.ts` module from the owning package. The order mirrors
 * `platformMigrationSources`: anything a later seed depends on (FK refs,
 * lookups) must come first.
 *
 * Seed functions receive an `INestApplicationContext` and call services
 * directly via `ctx.get(SomeService)` — no raw drizzle duplication of
 * service logic, no OnApplicationBootstrap.
 *
 * **No demo seeds at platform level.** Packages may only ship system
 * seeds (the peer of migrations — required for the package to function).
 * Demo data is opinionated sample content whose shape depends on the
 * consuming app; it belongs to the domain that wires the app together,
 * never to a platform package. See the `feedback_seeds_ownership` rule.
 *
 * Adding a new package seed:
 * 1. Create `packages/<tier>/<name>/api/seeds/system.ts` exporting
 *    `export const seedSystem: SeedFn`.
 * 2. Add `"./seeds/system": "./seeds/system.ts"` to the package's
 *    `exports` field (if using subpath exports).
 * 3. Register a new entry here in the correct dep order.
 */
export function platformSystemSeedSources(): SeedSource[] {
  const system = (
    name: PkgName,
    load: () => Promise<{ seedSystem: SeedFn }>,
  ): SeedSource => ({
    name,
    kind: 'system',
    load: () => load().then((m) => m.seedSystem),
  });

  return [
    system('@packages/auth', () => import('@packages/auth/seeds/system')),
    system('@packages/org-units', () => import('@packages/org-units/seeds/system')),
  ];
}
