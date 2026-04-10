/**
 * Per-Tenant Migration Runner
 *
 * Fetches all active tenants from the control-plane API and runs
 * Drizzle migrations against each tenant's database.
 *
 * Usage:
 *   npx tsx packages/tenancy/scripts/migrate-tenants.ts
 *
 * Environment:
 *   CONTROL_PLANE_URL  — Control-plane API base URL
 *   SERVICE_ID         — This service's identifier
 *   SERVICE_PRIVATE_KEY — PEM-encoded private key for service-auth
 *   MIGRATIONS_FOLDER  — Path to Drizzle migrations (default: ./apps/recruit/drizzle)
 */

import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

interface TenantInfo {
  id: string;
  slug: string;
  databaseUrl: string;
  status: string;
}

function getEnvOrDie(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`${name} environment variable is required`);
    process.exit(1);
  }
  return value;
}

function createServiceToken(): string {
  const serviceId = getEnvOrDie('SERVICE_ID');
  const privateKey = getEnvOrDie('SERVICE_PRIVATE_KEY');

  return jwt.sign(
    { iss: serviceId, aud: 'control-plane', scopes: ['tenants:read'] },
    privateKey,
    { algorithm: 'RS256', expiresIn: 300 },
  );
}

async function fetchActiveTenants(): Promise<TenantInfo[]> {
  const baseUrl = getEnvOrDie('CONTROL_PLANE_URL');
  const token = createServiceToken();

  const response = await fetch(`${baseUrl}/internal/tenants?status=active`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch tenants: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

async function main() {
  const tenants = await fetchActiveTenants();
  console.log(`Found ${tenants.length} active tenants\n`);

  const migrationsFolder = process.env.MIGRATIONS_FOLDER ?? './apps/recruit/drizzle';
  let success = 0;
  let failed = 0;

  for (const tenant of tenants) {
    console.log(`  Migrating tenant: ${tenant.slug} (${tenant.id})...`);

    const tenantPool = new Pool({ connectionString: tenant.databaseUrl });
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
}

main().catch(err => {
  console.error('Migration runner failed:', err);
  process.exit(1);
});
