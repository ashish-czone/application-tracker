/**
 * Per-Tenant Migration Runner
 *
 * For database-per-tenant mode: iterates all tenants in the control-plane DB
 * and runs Drizzle migrations against each tenant's database.
 *
 * For RLS mode: runs the RLS setup script against the shared database.
 *
 * Usage:
 *   npx tsx packages/tenancy/scripts/migrate-tenants.ts [--mode rls|database]
 *
 * Environment:
 *   DATABASE_URL — connection string for the control-plane database
 *   TENANCY_MODE — 'rls' or 'database' (can also be passed as --mode flag)
 */

import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

async function main() {
  const mode = getMode();
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  if (mode === 'rls') {
    console.log('RLS mode: Use apply-rls.ts script instead.');
    console.log('  npx tsx packages/tenancy/scripts/apply-rls.ts');
    process.exit(0);
  }

  if (mode === 'database') {
    await migrateTenantDatabases(databaseUrl);
  }
}

function getMode(): string {
  const args = process.argv.slice(2);
  const modeIndex = args.indexOf('--mode');
  if (modeIndex !== -1 && args[modeIndex + 1]) {
    return args[modeIndex + 1];
  }
  return process.env.TENANCY_MODE ?? 'database';
}

async function migrateTenantDatabases(controlPlaneUrl: string): Promise<void> {
  const controlPlane = new Pool({ connectionString: controlPlaneUrl });

  try {
    // Fetch all active tenants from control-plane
    const { rows: tenants } = await controlPlane.query(`
      SELECT id, slug, database_url, status
      FROM tenants
      WHERE status = 'active'
      ORDER BY slug
    `);

    console.log(`Found ${tenants.length} active tenants\n`);

    const migrationsFolder = process.env.MIGRATIONS_FOLDER ?? './apps/api/drizzle';
    let success = 0;
    let failed = 0;

    for (const tenant of tenants) {
      console.log(`  Migrating tenant: ${tenant.slug} (${tenant.id})...`);

      const tenantPool = new Pool({ connectionString: tenant.database_url });
      try {
        const db = drizzle(tenantPool);
        await migrate(db, { migrationsFolder });
        console.log(`    DONE`);
        success++;
      } catch (err) {
        console.error(`    FAILED: ${(err as Error).message}`);
        failed++;
      } finally {
        await tenantPool.end();
      }
    }

    console.log(`\nMigration complete: ${success} succeeded, ${failed} failed`);
    if (failed > 0) process.exit(1);
  } finally {
    await controlPlane.end();
  }
}

main().catch(err => {
  console.error('Migration runner failed:', err);
  process.exit(1);
});
