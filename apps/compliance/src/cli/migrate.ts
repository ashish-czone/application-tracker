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
    packageMigration(workspaceRoot, '@packages/tenancy'),
    packageMigration(workspaceRoot, '@packages/eav-attributes'),
    packageMigration(workspaceRoot, '@packages/entity-relations'),
    packageMigration(workspaceRoot, '@packages/org-units'),
    packageMigration(workspaceRoot, '@packages/notes'),
    packageMigration(workspaceRoot, '@packages/attachments'),
    packageMigration(workspaceRoot, '@packages/evaluations'),
    packageMigration(workspaceRoot, '@packages/document-templates'),
    {
      name: '@domains/compliance-api',
      migrationsFolder: path.join(workspaceRoot, 'domains/compliance/api/migrations'),
    },
  ];

  await runMigrations({ packages });
}

main().catch((err) => {
  console.error('[db:migrate] failed:', err);
  process.exit(1);
});
