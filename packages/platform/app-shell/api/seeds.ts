import type { SeedSource, SeedFn } from '@packages/database/seeder';

type PkgName = '@packages/auth' | '@packages/entity-engine';

/**
 * Ordered list of **core + platform** system seed sources. Each entry
 * lazy-loads a `seeds/system.ts` module from the owning package. The
 * order reflects cross-package dependencies: anything a later seed
 * depends on (FK refs, lookups) must come first.
 *
 * Scope: core and platform tier packages only. Addon packages
 * (`packages/addons/*`) are opt-in per app — apps that mount an addon
 * module must register the addon's seed source in their own `seed.ts`
 * CLI alongside `...platformSystemSeedSources()`. Examples:
 *   - `@packages/org-units` → registered by apps that mount `OrgUnitsModule`
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
 * Adding a new core/platform package seed:
 * 1. Create `packages/<core|platform>/<name>/api/seeds/system.ts`
 *    exporting `export const seedSystem: SeedFn`.
 * 2. Add `"./seeds/system": "./seeds/system.ts"` to the package's
 *    `exports` field (if using subpath exports).
 * 3. Register a new entry here in the correct dep order.
 *
 * Addon seeds stay out of this list — register them per-app.
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
    system('@packages/entity-engine', () => import('@packages/entity-engine/seeds/system')),
  ];
}
