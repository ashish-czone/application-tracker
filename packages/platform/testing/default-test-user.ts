import type { DrizzleDB } from '@packages/database';
import { sql } from 'drizzle-orm';

/**
 * Stable user ID used as the default actor for `withAuth(perms)` calls that
 * don't pass an explicit `userId`. Seeded into the `users` table by
 * `createPackageTestApp` and re-seeded by the platform-testing
 * `cleanDatabase` wrapper, so every audited event written via the test
 * harness has a real FK target.
 */
export const DEFAULT_TEST_USER_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Inserts (or no-ops on conflict) the default test user via raw SQL so
 * the seed only references the bare minimum columns. The Drizzle `users`
 * schema in `@packages/database` includes columns (`invited_at`, etc.) that
 * older test-DB migration chains (e.g. apps/api/drizzle) don't yet have;
 * sticking to the original-migration column set keeps the seed compatible
 * with every chain.
 */
export async function seedDefaultTestUser(db: DrizzleDB): Promise<void> {
  await db.execute(sql`
    INSERT INTO "users" ("id", "email", "first_name", "last_name", "user_type", "updated_at")
    VALUES (${DEFAULT_TEST_USER_ID}, 'default-test-user@example.test', 'Default', 'TestUser', 'admin', now())
    ON CONFLICT ("id") DO NOTHING
  `);
}

/**
 * Truncates every public-schema table (mirroring `@packages/testing`'s
 * `cleanDatabase`) and re-inserts the default test user, so subsequent
 * `withAuth(perms)` requests still have a valid actor row.
 */
export async function cleanDatabase(db: DrizzleDB): Promise<void> {
  const tables = await db.execute<{ tablename: string }>(
    sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
  );
  for (const { tablename } of tables.rows) {
    if (tablename !== 'drizzle_migrations' && tablename !== '__drizzle_migrations') {
      await db.execute(sql.raw(`TRUNCATE TABLE "${tablename}" CASCADE`));
    }
  }
  await seedDefaultTestUser(db);
}
