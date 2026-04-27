import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { runMigrations, type PackageMigrationSource } from '@packages/database/migrator';
import {
  findWorkspaceRoot,
  kernelMigrationSources,
  packageMigration,
} from '@packages/app-shell/migrations';

async function main() {
  const workspaceRoot = findWorkspaceRoot(__dirname);
  loadEnv({ path: path.resolve(__dirname, '../../.env') });

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
