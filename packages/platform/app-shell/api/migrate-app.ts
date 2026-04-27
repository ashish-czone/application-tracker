import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { runMigrations, type PackageMigrationSource } from '@packages/database/migrator';
import {
  findWorkspaceRoot,
  kernelMigrationSources,
  packageMigration,
} from './migrations';
import type { Addon } from './addon';

export interface RunAppMigrationsOptions {
  /**
   * Pass `__dirname` from the calling migrate.ts. Used to locate the workspace
   * root and the app's `.env` file (assumed at `<callerDir>/../../.env`).
   */
  callerDir: string;
  /**
   * The addons this app uses. Must be the same array consumed by
   * `createAppModule({ addons })` in the app's `app.module.ts` so module
   * loading and migration application stay in lockstep.
   */
  addons: readonly Addon[];
  /**
   * Domain-specific migration sources (e.g. `@domains/agency-api/pages`).
   * Receives the workspace root so the caller can build absolute paths
   * cleanly. Returned migrations run after the kernel + addon migrations.
   */
  domainMigrations?: (workspaceRoot: string) => PackageMigrationSource[];
  /**
   * Override the env file location. Defaults to `<callerDir>/../../.env`.
   */
  envFile?: string;
}

/**
 * Boilerplate-eliminating wrapper around `runMigrations`. Loads the .env,
 * resolves the workspace root, and concatenates kernel + addon + domain
 * migrations in dependency order.
 */
export async function runAppMigrations(opts: RunAppMigrationsOptions): Promise<void> {
  const workspaceRoot = findWorkspaceRoot(opts.callerDir);
  const envPath = opts.envFile ?? path.resolve(opts.callerDir, '../../.env');
  loadEnv({ path: envPath });

  const packages: PackageMigrationSource[] = [
    ...kernelMigrationSources(workspaceRoot),
    ...opts.addons.map((addon) => packageMigration(workspaceRoot, addon.migration)),
    ...(opts.domainMigrations ? opts.domainMigrations(workspaceRoot) : []),
  ];

  await runMigrations({ packages });
}
