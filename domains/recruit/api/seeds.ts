import type { SeedSource } from '@packages/database/seeder';

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
  return [];
}
