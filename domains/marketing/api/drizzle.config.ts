import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: ['./monitoring/sources/schema', './monitoring/keywords/schema'],
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://placeholder',
  },
});
