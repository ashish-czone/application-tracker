import path from 'node:path';
import { runAppMigrations, type Addon } from '@packages/app-shell';
import { contentAddon } from '@packages/content-api';
import { hierarchyAddon } from '@packages/hierarchy';
import { mediaLibraryAddon } from '@packages/media-library-api';
import { taxonomyAddon } from '@packages/taxonomy';

/**
 * Vitest globalSetup for @domains/agency-api integration tests.
 *
 * Mirrors the addon list declared in apps/agency/src/addons.ts so the
 * integration test database has every table the agency app needs at boot.
 * The default platform global-setup shells out to drizzle-kit for apps/api +
 * apps/recruit, which does not cover the addon tables (pages, content,
 * menus, media-library) that agency relies on.
 *
 * The list is duplicated rather than imported from apps/agency/src to
 * preserve the dependency rule that domains never import apps. If addons
 * drift between this file and apps/agency, the integration test fails with
 * a clear "relation does not exist" — same diagnostic as before.
 */
const testAddons: readonly Addon[] = [
  taxonomyAddon,
  hierarchyAddon,
  contentAddon,
  mediaLibraryAddon,
];

export default async function globalSetup() {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'postgresql://dev:dev@localhost:5432/starter';
  }

  try {
    await runAppMigrations({
      callerDir: __dirname,
      addons: testAddons,
      domainMigrations: (workspaceRoot) => [
        {
          name: '@domains/agency-api/pages',
          migrationsFolder: path.join(workspaceRoot, 'domains/agency/api/pages/migrations'),
        },
        {
          name: '@domains/agency-api/menus',
          migrationsFolder: path.join(workspaceRoot, 'domains/agency/api/menus/migrations'),
        },
      ],
    });
  } catch (err) {
    // Surface the error so the suite fails fast rather than running against
    // a partially-migrated DB and producing confusing table-not-found errors.
    console.error('[agency-api integration] migration failed:', err);
    throw err;
  }
}
