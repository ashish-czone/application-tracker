import type { DrizzleDB } from '@packages/database';
import { sql } from '@packages/database';

export async function cleanDatabase(db: DrizzleDB) {
  const tables = await db.execute<{ tablename: string }>(
    sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
  );
  for (const { tablename } of tables.rows) {
    if (tablename !== '_prisma_migrations') {
      await db.execute(sql.raw(`TRUNCATE TABLE "${tablename}" CASCADE`));
    }
  }
}
