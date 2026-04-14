/**
 * Tenant Provisioning Script
 *
 * Queries the control-plane API for tenants in 'provisioning' status,
 * creates their databases, runs migrations, and activates them.
 *
 * Usage:
 *   npx tsx packages/tenancy/scripts/provision-tenant.ts [--slug <slug>] [--all-pending]
 *
 * Flags:
 *   --slug <slug>      Provision a specific tenant by slug
 *   --all-pending      Provision all tenants in 'provisioning' status
 *
 * Environment:
 *   CONTROL_PLANE_URL  — Control-plane API base URL (e.g., http://localhost:3013)
 *   SERVICE_ID         — This service's identifier (e.g., 'recruit-app')
 *   SERVICE_PRIVATE_KEY — PEM-encoded private key for service-auth
 *   DATABASE_ADMIN_URL — PostgreSQL admin connection for CREATE DATABASE
 *                        (e.g., postgresql://admin:pass@localhost:5432/postgres)
 *   MIGRATIONS_FOLDER  — Path to a Drizzle migrations folder (required)
 */

import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

interface TenantInfo {
  id: string;
  slug: string;
  name: string;
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
    { iss: serviceId, aud: 'control-plane', scopes: ['tenants:read', 'tenants:provision'] },
    privateKey,
    { algorithm: 'RS256', expiresIn: 300 },
  );
}

async function callControlPlane(path: string, options: RequestInit = {}): Promise<Response> {
  const baseUrl = getEnvOrDie('CONTROL_PLANE_URL');
  const token = createServiceToken();

  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
}

async function fetchPendingTenants(): Promise<TenantInfo[]> {
  const response = await callControlPlane('/internal/tenants?status=provisioning');
  if (!response.ok) {
    throw new Error(`Failed to fetch tenants: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

async function fetchTenantBySlug(slug: string): Promise<TenantInfo> {
  const response = await callControlPlane(`/internal/tenants/${encodeURIComponent(slug)}`);
  if (!response.ok) {
    throw new Error(`Tenant '${slug}' not found: ${response.status}`);
  }
  return response.json();
}

async function activateTenant(id: string): Promise<void> {
  const response = await callControlPlane(`/internal/tenants/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'active' }),
  });
  if (!response.ok) {
    throw new Error(`Failed to activate tenant ${id}: ${response.status}`);
  }
}

function extractDatabaseName(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  const dbName = url.pathname.slice(1); // remove leading /
  if (!dbName) {
    throw new Error(`Cannot extract database name from: ${databaseUrl}`);
  }
  return dbName;
}

async function createDatabase(adminUrl: string, dbName: string): Promise<void> {
  const pool = new Pool({ connectionString: adminUrl });
  try {
    // Check if database already exists
    const { rows } = await pool.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName],
    );
    if (rows.length > 0) {
      console.log(`    Database '${dbName}' already exists, skipping creation`);
      return;
    }

    // CREATE DATABASE cannot run inside a transaction
    await pool.query(`CREATE DATABASE "${dbName}"`);
    console.log(`    Created database '${dbName}'`);
  } finally {
    await pool.end();
  }
}

async function runMigrations(databaseUrl: string): Promise<void> {
  const migrationsFolder = getEnvOrDie('MIGRATIONS_FOLDER');
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder });
    console.log(`    Migrations applied`);
  } finally {
    await pool.end();
  }
}

async function provisionTenant(tenant: TenantInfo, adminUrl: string): Promise<boolean> {
  console.log(`\n  Provisioning: ${tenant.slug} (${tenant.id})`);

  try {
    const dbName = extractDatabaseName(tenant.databaseUrl);

    // Step 1: Create the database
    await createDatabase(adminUrl, dbName);

    // Step 2: Run migrations
    await runMigrations(tenant.databaseUrl);

    // Step 3: Activate via control-plane API
    await activateTenant(tenant.id);
    console.log(`    Activated ✓`);

    return true;
  } catch (err) {
    console.error(`    FAILED: ${(err as Error).message}`);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const slugIndex = args.indexOf('--slug');
  const allPending = args.includes('--all-pending');

  if (!slugIndex && !allPending && slugIndex === -1) {
    console.error('Usage: provision-tenant.ts --slug <slug> | --all-pending');
    process.exit(1);
  }

  const adminUrl = getEnvOrDie('DATABASE_ADMIN_URL');

  let tenants: TenantInfo[];

  if (slugIndex !== -1 && args[slugIndex + 1]) {
    const tenant = await fetchTenantBySlug(args[slugIndex + 1]);
    if (tenant.status !== 'provisioning') {
      console.error(`Tenant '${tenant.slug}' is '${tenant.status}', not 'provisioning'`);
      process.exit(1);
    }
    tenants = [tenant];
  } else if (allPending) {
    tenants = await fetchPendingTenants();
  } else {
    console.error('Usage: provision-tenant.ts --slug <slug> | --all-pending');
    process.exit(1);
  }

  console.log(`Found ${tenants.length} tenant(s) to provision`);

  if (tenants.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  let success = 0;
  let failed = 0;

  for (const tenant of tenants) {
    const ok = await provisionTenant(tenant, adminUrl);
    if (ok) success++;
    else failed++;
  }

  console.log(`\nProvisioning complete: ${success} succeeded, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error('Provisioning script failed:', err);
  process.exit(1);
});
