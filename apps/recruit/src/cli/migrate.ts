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
      name: '@domains/recruit-api',
      migrationsFolder: path.join(workspaceRoot, 'domains/recruit/api/migrations'),
    },
  ];

  await runMigrations({ packages });
}

main().catch((err) => {
  console.error('[db:migrate] failed:', err);
  process.exit(1);
});
