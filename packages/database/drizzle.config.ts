import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: [
    './schema/index.ts',
    '../auth/schema/index.ts',
  ],
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
