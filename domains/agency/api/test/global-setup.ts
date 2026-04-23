import path from 'node:path';
import { runMigrations, type PackageMigrationSource } from '@packages/database/migrator';
import {
  findWorkspaceRoot,
  platformMigrationSources,
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
    ...platformMigrationSources(workspaceRoot),
    {
      name: '@packages/pages-api',
      migrationsFolder: path.join(workspaceRoot, 'packages/addons/pages/api/migrations'),
    },
    {
      name: '@packages/content-api',
      migrationsFolder: path.join(workspaceRoot, 'packages/addons/content/api/migrations'),
    },
    {
      name: '@packages/menus-api',
      migrationsFolder: path.join(workspaceRoot, 'packages/addons/menus/api/migrations'),
    },
    {
      name: '@packages/media-library-api',
      migrationsFolder: path.join(workspaceRoot, 'packages/addons/media-library/api/migrations'),
    },
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
