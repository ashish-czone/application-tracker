import path from 'node:path';
import { Pool } from 'pg';
import { runMigrations } from '@packages/database/migrator';
import { platformMigrationSources } from '@packages/app-shell/migrations';

/**
 * Vitest `globalSetup` for compliance integration tests. Resets the public
 * schema, then runs the full platform + compliance migration chain once
 * before any test file.
 *
 * Why reset first: local dev DBs can contain state from a previous
 * `drizzle-kit migrate` (shared global-setup), which tracks applied
 * migrations in `drizzle.__drizzle_migrations`. Our migrator uses
 * per-package `__drizzle_migrations__<pkg>` tables — a different tracking
 * system — so without a reset, re-running migrations on an existing schema
 * throws "relation already exists". The reset is safe: integration tests
 * already truncate everything between tests via `cleanDatabase()`.
 *
 * The shared `@packages/testing` global-setup only migrates `apps/api` +
 * `apps/recruit`; it doesn't know about compliance. We replicate the
 * migration list from `apps/compliance/src/cli/migrate.ts` here so the test
 * DB has every table the ComplianceDomainModule touches at boot.
 *
 * DATABASE_URL must point at a Postgres instance the tests can reset;
 * the default matches `docker-compose.yml` (postgresql://dev:dev@localhost:5432/starter).
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

  const workspaceRoot = path.resolve(__dirname, '../../../../..');
  const packages = [
    ...platformMigrationSources(workspaceRoot),
    {
      name: '@domains/compliance-api',
      migrationsFolder: path.join(workspaceRoot, 'domains/compliance/api/migrations'),
    },
  ];

  await runMigrations({ packages, logger: () => {} });
}
