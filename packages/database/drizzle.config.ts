import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: [
    './schema/index.ts',
    '../auth/schema/index.ts',
    '../rbac/schema/index.ts',
    '../settings/schema/index.ts',
    '../notifications/schema/index.ts',
    '../workflows/schema/index.ts',
    '../taxonomy/schema/index.ts',
    '../audit/schema/index.ts',
  ],
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
