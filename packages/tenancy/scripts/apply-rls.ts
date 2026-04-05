/**
 * RLS Migration Script
 *
 * Reads all tables from the database and applies multi-tenancy setup:
 * 1. Adds tenant_id column to each table (if not present)
 * 2. Rebuilds unique indices to include tenant_id
 * 3. Creates RLS policies for tenant isolation
 * 4. Creates a performance index on tenant_id
 *
 * Usage:
 *   npx tsx packages/tenancy/scripts/apply-rls.ts
 *
 * Environment:
 *   DATABASE_URL — connection string for the target database
 *
 * The script is idempotent — safe to run multiple times.
 */

import { Pool } from 'pg';

const EXCLUDED_TABLES = new Set([
  'tenants',             // control-plane table, not tenant-scoped
  'drizzle.__drizzle_migrations', // drizzle internals
]);

const SCHEMA = 'public';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    console.log('Starting RLS migration...\n');

    // 1. Get all tables
    const tables = await getTables(pool);
    console.log(`Found ${tables.length} tables\n`);

    for (const table of tables) {
      if (EXCLUDED_TABLES.has(table)) {
        console.log(`  SKIP  ${table} (excluded)`);
        continue;
      }

      console.log(`  Processing ${table}...`);

      // 2. Add tenant_id column if not present
      await addTenantIdColumn(pool, table);

      // 3. Rebuild unique indices to include tenant_id
      await rebuildUniqueIndices(pool, table);

      // 4. Enable RLS and create policies
      await enableRls(pool, table);

      // 5. Create performance index on tenant_id
      await createTenantIdIndex(pool, table);

      console.log(`  DONE  ${table}`);
    }

    // 6. Create bypass role for admin/migration operations
    await createBypassRole(pool);

    console.log('\nRLS migration complete.');
  } finally {
    await pool.end();
  }
}

async function getTables(pool: Pool): Promise<string[]> {
  const result = await pool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = $1
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `, [SCHEMA]);

  return result.rows.map(r => r.table_name);
}

async function addTenantIdColumn(pool: Pool, table: string): Promise<void> {
  const { rows } = await pool.query(`
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = $1 AND table_name = $2 AND column_name = 'tenant_id'
  `, [SCHEMA, table]);

  if (rows.length > 0) return; // Already has tenant_id

  await pool.query(`
    ALTER TABLE "${SCHEMA}"."${table}"
    ADD COLUMN tenant_id TEXT NOT NULL DEFAULT current_setting('app.tenant_id', true)
  `);
  console.log(`    + Added tenant_id column`);
}

async function rebuildUniqueIndices(pool: Pool, table: string): Promise<void> {
  // Find all unique indices on this table (excluding primary keys)
  const { rows: indices } = await pool.query(`
    SELECT
      i.relname AS index_name,
      array_agg(a.attname ORDER BY x.ordinality) AS columns,
      ix.indisprimary AS is_primary
    FROM pg_index ix
    JOIN pg_class t ON t.oid = ix.indrelid
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    CROSS JOIN LATERAL unnest(ix.indkey) WITH ORDINALITY AS x(attnum, ordinality)
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = x.attnum
    WHERE n.nspname = $1
      AND t.relname = $2
      AND ix.indisunique = true
      AND ix.indisprimary = false
    GROUP BY i.relname, ix.indisprimary
  `, [SCHEMA, table]);

  for (const idx of indices) {
    const columns: string[] = idx.columns;

    // Skip if tenant_id is already in the index
    if (columns.includes('tenant_id')) continue;

    const newColumns = [...columns, 'tenant_id'];
    const newIndexName = `${idx.index_name}_tenant`;

    // Drop old index and create new one with tenant_id
    await pool.query(`DROP INDEX IF EXISTS "${SCHEMA}"."${idx.index_name}"`);
    await pool.query(`
      CREATE UNIQUE INDEX "${newIndexName}"
      ON "${SCHEMA}"."${table}" (${newColumns.map(c => `"${c}"`).join(', ')})
    `);
    console.log(`    ~ Rebuilt index ${idx.index_name} → ${newIndexName} (added tenant_id)`);
  }
}

async function enableRls(pool: Pool, table: string): Promise<void> {
  // Enable RLS
  await pool.query(`ALTER TABLE "${SCHEMA}"."${table}" ENABLE ROW LEVEL SECURITY`);

  // Drop existing policy if present (idempotent)
  await pool.query(`
    DROP POLICY IF EXISTS tenant_isolation ON "${SCHEMA}"."${table}"
  `);

  // Create policy — uses current_setting('app.tenant_id', true) which returns NULL if not set
  // The 'true' parameter makes it return NULL instead of throwing when the setting doesn't exist
  await pool.query(`
    CREATE POLICY tenant_isolation ON "${SCHEMA}"."${table}"
      USING (tenant_id = current_setting('app.tenant_id', true))
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true))
  `);

  console.log(`    + RLS policy created`);
}

async function createTenantIdIndex(pool: Pool, table: string): Promise<void> {
  const indexName = `idx_${table}_tenant_id`;

  // Check if index already exists
  const { rows } = await pool.query(`
    SELECT 1 FROM pg_indexes
    WHERE schemaname = $1 AND tablename = $2 AND indexname = $3
  `, [SCHEMA, table, indexName]);

  if (rows.length > 0) return;

  await pool.query(`
    CREATE INDEX "${indexName}" ON "${SCHEMA}"."${table}" (tenant_id)
  `);
  console.log(`    + Created index ${indexName}`);
}

async function createBypassRole(pool: Pool): Promise<void> {
  // Create a role that bypasses RLS for admin/migration operations
  const roleName = 'tenant_admin';

  const { rows } = await pool.query(`
    SELECT 1 FROM pg_roles WHERE rolname = $1
  `, [roleName]);

  if (rows.length > 0) {
    console.log(`\n  Role '${roleName}' already exists`);
    return;
  }

  await pool.query(`CREATE ROLE "${roleName}" NOLOGIN`);
  await pool.query(`ALTER ROLE "${roleName}" BYPASSRLS`);
  console.log(`\n  + Created bypass role '${roleName}'`);
}

main().catch(err => {
  console.error('RLS migration failed:', err);
  process.exit(1);
});
