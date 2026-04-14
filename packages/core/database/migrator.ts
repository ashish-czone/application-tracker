import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

export interface PackageMigrationSource {
  name: string;
  migrationsFolder: string;
}

export interface RunMigrationsOptions {
  packages: PackageMigrationSource[];
  databaseUrl?: string;
  logger?: (message: string) => void;
}

export function migrationsTableFor(packageName: string): string {
  const slug = packageName.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return `__drizzle_migrations__${slug}`;
}

export async function runMigrations({
  packages,
  databaseUrl = process.env.DATABASE_URL,
  logger = (message) => console.log(`[db:migrate] ${message}`),
}: RunMigrationsOptions): Promise<void> {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to run migrations');
  }
  if (packages.length === 0) {
    logger('no packages provided, nothing to do');
    return;
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const db: NodePgDatabase = drizzle(pool);

  try {
    for (const pkg of packages) {
      const migrationsTable = migrationsTableFor(pkg.name);
      logger(`applying ${pkg.name} (${pkg.migrationsFolder}) -> ${migrationsTable}`);
      await migrate(db, {
        migrationsFolder: pkg.migrationsFolder,
        migrationsTable,
      });
    }
    logger(`done (${packages.length} package${packages.length === 1 ? '' : 's'})`);
  } finally {
    await pool.end();
  }
}
