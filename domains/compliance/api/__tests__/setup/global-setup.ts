import path from 'node:path';
import { Pool } from 'pg';
import { runAppMigrations, type Addon } from '@packages/app-shell';
import { attachmentsAddon } from '@packages/attachments';
import { automationsAddon } from '@packages/automations';
import { documentTemplatesAddon } from '@packages/document-templates';
import { eavAttributesAddon } from '@packages/eav-attributes';
import { entityRelationsAddon } from '@packages/entity-relations';
import { evaluationsAddon } from '@packages/evaluations';
import { hierarchyAddon } from '@packages/hierarchy';
import { notesAddon } from '@packages/notes';
import { orgUnitsAddon } from '@packages/org-units';
import { tasksAddon } from '@packages/tasks';
import { taxonomyAddon } from '@packages/taxonomy';
import { workflowsAddon } from '@packages/workflows';

/**
 * Vitest `globalSetup` for compliance integration tests. Resets the public
 * schema, then runs the platform + compliance migration chain once before
 * any test file.
 *
 * Mirrors the addon list in apps/compliance/src/addons.ts (omitting tenancy,
 * which is conditional in the app and not exercised by integration tests).
 * Duplicated here rather than imported to preserve the rule that domains
 * never depend on apps; drift between the two surfaces as a "relation does
 * not exist" failure in the suite.
 *
 * Why reset first: local dev DBs can contain state from a previous
 * `drizzle-kit migrate` (shared global-setup), which tracks applied
 * migrations in `drizzle.__drizzle_migrations`. Our migrator uses
 * per-package `__drizzle_migrations__<pkg>` tables — a different tracking
 * system — so without a reset, re-running migrations on an existing schema
 * throws "relation already exists". The reset is safe: integration tests
 * already truncate everything between tests via `cleanDatabase()`.
 *
 * DATABASE_URL must point at a Postgres instance the tests can reset;
 * the default matches `docker-compose.yml` (postgresql://dev:dev@localhost:5432/starter).
 */
const testAddons: readonly Addon[] = [
  automationsAddon,
  workflowsAddon,
  attachmentsAddon,
  documentTemplatesAddon(),
  eavAttributesAddon,
  entityRelationsAddon,
  evaluationsAddon,
  hierarchyAddon,
  notesAddon,
  orgUnitsAddon,
  taxonomyAddon,
  tasksAddon,
];

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
        name: '@domains/compliance-api',
        migrationsFolder: path.join(workspaceRoot, 'domains/compliance/api/migrations'),
      },
    ],
  });
}
