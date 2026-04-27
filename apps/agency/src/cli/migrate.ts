import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { runMigrations, type PackageMigrationSource } from '@packages/database/migrator';
import {
  findWorkspaceRoot,
  platformMigrationSources,
} from '@packages/app-shell/migrations';

async function main() {
  const workspaceRoot = findWorkspaceRoot(__dirname);
  loadEnv({ path: path.resolve(__dirname, '../../.env') });

  const packages: PackageMigrationSource[] = [
    ...platformMigrationSources(workspaceRoot),
    {
      name: '@domains/agency-api/pages',
      migrationsFolder: path.join(workspaceRoot, 'domains/agency/api/pages/migrations'),
    },
    {
      name: '@packages/content-api',
      migrationsFolder: path.join(workspaceRoot, 'packages/addons/content/api/migrations'),
    },
    {
      name: '@domains/agency-api/menus',
      migrationsFolder: path.join(workspaceRoot, 'domains/agency/api/menus/migrations'),
    },
    {
      name: '@packages/media-library-api',
      migrationsFolder: path.join(workspaceRoot, 'packages/addons/media-library/api/migrations'),
    },
    {
      name: '@domains/projects-api',
      migrationsFolder: path.join(workspaceRoot, 'domains/projects/api/migrations'),
    },
  ];

  await runMigrations({ packages });
}

main().catch((err) => {
  console.error('[db:migrate] failed:', err);
  process.exit(1);
});
