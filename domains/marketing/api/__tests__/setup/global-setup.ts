import path from 'node:path';
import { Pool } from 'pg';
import { runAppMigrations } from '@packages/app-shell';

/**
 * Vitest globalSetup for marketing integration tests. Resets the public
 * schema, then runs the platform + marketing migration chain once before
 * any test file. Marketing has no addon deps beyond what platform-testing
 * already wires by default — no workflows, no entity-engine — so the
 * addon list here is empty.
 *
 * Resets the schema first because local dev DBs may carry state from a
 * previous `drizzle-kit migrate`. Per-package migration tracking
 * (`__drizzle_migrations__<pkg>`) doesn't tolerate "relation already
 * exists" on re-run; truncating between cases via `cleanDatabase()` is
 * cheap.
 */
export default async function setup(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'postgresql://dev:dev@localhost:5432/starter';
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query('DROP SCHEMA IF EXISTS public CASCADE');
    await pool.query('DROP SCHEMA IF EXISTS drizzle CASCADE');
    await pool.query('CREATE SCHEMA public');
  } finally {
    await pool.end();
  }

  await runAppMigrations({
    callerDir: __dirname,
    addons: [],
    domainMigrations: (workspaceRoot) => [
      {
        name: '@domains/marketing-api',
        migrationsFolder: path.join(workspaceRoot, 'domains/marketing/api/migrations'),
      },
    ],
  });
}
