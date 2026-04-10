import { execSync } from 'child_process';
import path from 'path';

/**
 * Vitest globalSetup function for integration tests.
 * Runs Drizzle migrations against the test database.
 *
 * Usage in vitest.integration.ts:
 *   globalSetup: [require.resolve('@packages/testing/global-setup')]
 */
export function integrationGlobalSetup() {
  const env = {
    ...process.env,
    DATABASE_URL:
      process.env.DATABASE_URL ?? 'postgresql://dev:dev@localhost:5432/starter',
  };

  // Run migrations for all apps that define schemas used by packages
  const appDirs = [
    path.resolve(__dirname, '../../../apps/api'),
    path.resolve(__dirname, '../../../apps/recruit'),
  ];

  for (const appDir of appDirs) {
    try {
      execSync('npx drizzle-kit migrate', { cwd: appDir, stdio: 'inherit', env });
    } catch {
      console.warn(`[testing] Database migration skipped for ${path.basename(appDir)} (DB may be unavailable)`);
    }
  }
}

export default integrationGlobalSetup;
