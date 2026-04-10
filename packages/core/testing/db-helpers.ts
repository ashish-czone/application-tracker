import type { DrizzleDB } from '@packages/database';
import { sql } from 'drizzle-orm';

/**
 * Truncates all tables in the public schema.
 * Use in afterEach/afterAll to clean up between tests.
 */
export async function cleanDatabase(db: DrizzleDB) {
  const tables = await db.execute<{ tablename: string }>(
    sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
  );
  for (const { tablename } of tables.rows) {
    if (tablename !== 'drizzle_migrations' && tablename !== '__drizzle_migrations') {
      await db.execute(sql.raw(`TRUNCATE TABLE "${tablename}" CASCADE`));
    }
  }
}
