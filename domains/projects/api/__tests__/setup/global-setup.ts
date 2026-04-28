import path from 'node:path';
import { Pool } from 'pg';
import { runAppMigrations, type Addon } from '@packages/app-shell';
import { workflowsAddon } from '@packages/workflows';

/**
 * Vitest globalSetup for projects integration tests. Resets the public
 * schema, then runs the platform + projects migration chain once before any
 * test file. Mirrors the addon list `apps/agency` consumes at runtime,
 * scoped down to what the projects domain actually depends on (workflows
 * is the only addon — projects' four entity configs all use `workflow`
 * fields, which require the workflow tables to exist).
 *
 * Why reset first: local dev DBs may carry state from a previous
 * `drizzle-kit migrate` run, which uses a different migrations-tracking
 * scheme than our per-package `__drizzle_migrations__<pkg>` tables.
 * Without reset, re-running migrations on an existing schema throws
 * "relation already exists". Reset is safe — integration tests truncate
 * everything between cases via `cleanDatabase()`.
 */
const testAddons: readonly Addon[] = [workflowsAddon];

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
    addons: testAddons,
    domainMigrations: (workspaceRoot) => [
      {
        name: '@domains/projects-api',
        migrationsFolder: path.join(workspaceRoot, 'domains/projects/api/migrations'),
      },
    ],
  });
}
