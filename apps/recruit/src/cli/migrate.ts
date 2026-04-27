import path from 'node:path';
import { runAppMigrations } from '@packages/app-shell';
import { recruitAddons } from '../addons';

runAppMigrations({
  callerDir: __dirname,
  addons: recruitAddons,
  domainMigrations: (workspaceRoot) => [
    {
      name: '@domains/recruit-api',
      migrationsFolder: path.join(workspaceRoot, 'domains/recruit/api/migrations'),
    },
  ],
}).catch((err) => {
  console.error('[db:migrate] failed:', err);
  process.exit(1);
});
