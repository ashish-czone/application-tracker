/**
 * Vitest setupFile that sets DATABASE_URL if not already set.
 * Ensures the test process can connect to the database.
 */
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://dev:dev@localhost:5432/starter';
}
