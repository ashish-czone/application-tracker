import path from 'node:path';
import { runAppMigrations } from '@packages/app-shell';
import { complianceAddons } from '../addons';

runAppMigrations({
  callerDir: __dirname,
  addons: complianceAddons,
  domainMigrations: (workspaceRoot) => [
    {
      name: '@domains/compliance-api',
      migrationsFolder: path.join(workspaceRoot, 'domains/compliance/api/migrations'),
    },
  ],
}).catch((err) => {
  console.error('[db:migrate] failed:', err);
  process.exit(1);
});
