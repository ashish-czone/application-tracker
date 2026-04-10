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
  const apiDir = path.resolve(__dirname, '../../../apps/api');

  try {
    execSync('npx drizzle-kit migrate', {
      cwd: apiDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL:
          process.env.DATABASE_URL ?? 'postgresql://dev:dev@localhost:5432/starter',
      },
    });
  } catch {
    console.warn('[testing] Database migration skipped (DB may be unavailable)');
  }
}

export default integrationGlobalSetup;
