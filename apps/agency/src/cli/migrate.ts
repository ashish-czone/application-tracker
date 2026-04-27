import path from 'node:path';
import { runAppMigrations } from '@packages/app-shell';
import { agencyAddons } from '../addons';

runAppMigrations({
  callerDir: __dirname,
  addons: agencyAddons,
  domainMigrations: (workspaceRoot) => [
    {
      name: '@domains/agency-api/pages',
      migrationsFolder: path.join(workspaceRoot, 'domains/agency/api/pages/migrations'),
    },
    {
      name: '@domains/agency-api/menus',
      migrationsFolder: path.join(workspaceRoot, 'domains/agency/api/menus/migrations'),
    },
    {
      name: '@domains/projects-api',
      migrationsFolder: path.join(workspaceRoot, 'domains/projects/api/migrations'),
    },
  ],
}).catch((err) => {
  console.error('[db:migrate] failed:', err);
  process.exit(1);
});
