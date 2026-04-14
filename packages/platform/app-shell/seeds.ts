import type { SeedSource } from '@packages/database/seeder';

/**
 * Ordered list of platform seed sources. Each entry lazy-loads a
 * `seeds/system.ts` or `seeds/demo.ts` module from the owning package.
 * The order mirrors `platformMigrationSources`: anything a later seed
 * depends on (FK refs, lookups) must come first.
 *
 * Seed functions receive an `INestApplicationContext` and call services
 * directly via `ctx.get(SomeService)` — no raw drizzle, no logic
 * duplication, no OnApplicationBootstrap.
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
  return [];
}
