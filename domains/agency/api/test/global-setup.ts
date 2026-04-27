import path from 'node:path';
import { runMigrations, type PackageMigrationSource } from '@packages/database/migrator';
import {
  findWorkspaceRoot,
  kernelMigrationSources,
  packageMigration,
} from '@packages/app-shell/migrations';

/**
 * Vitest globalSetup for @domains/agency-api integration tests.
 *
 * Mirrors the migration chain declared in apps/agency/src/cli/migrate.ts so
 * the integration test database has every table the `AgencyDomainModule`
 * touches at boot. The default platform global-setup shells out to
 * drizzle-kit for apps/api + apps/recruit, which does not cover the
 * addon tables (pages, content, menus, media-library) that agency relies on.
 */
export default async function globalSetup() {
  const workspaceRoot = findWorkspaceRoot(__dirname);
  const databaseUrl =
    process.env.DATABASE_URL ?? 'postgresql://dev:dev@localhost:5432/starter';

  const packages: PackageMigrationSource[] = [
    ...kernelMigrationSources(workspaceRoot),
    packageMigration(workspaceRoot, '@packages/taxonomy'),
    packageMigration(workspaceRoot, '@packages/hierarchy'),
    {
      name: '@domains/agency-api/pages',
      migrationsFolder: path.join(workspaceRoot, 'domains/agency/api/pages/migrations'),
    },
    packageMigration(workspaceRoot, '@packages/content-api'),
    {
      name: '@domains/agency-api/menus',
      migrationsFolder: path.join(workspaceRoot, 'domains/agency/api/menus/migrations'),
    },
    packageMigration(workspaceRoot, '@packages/media-library-api'),
  ];

  try {
    await runMigrations({ packages, databaseUrl });
  } catch (err) {
    // Surface the error so the suite fails fast rather than running against
    // a partially-migrated DB and producing confusing table-not-found errors.
    console.error('[agency-api integration] migration failed:', err);
    throw err;
  }
}
