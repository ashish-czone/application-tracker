import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: [
    // Shared infrastructure
    '../../packages/database/schema/index.ts',
    '../../packages/auth/schema/index.ts',
    '../../packages/rbac/schema/index.ts',
    '../../packages/settings/schema/index.ts',
    '../../packages/notifications/schema/index.ts',
    '../../packages/workflows/schema/index.ts',
    '../../packages/taxonomy/schema/index.ts',
    '../../packages/audit/schema/index.ts',
    // App-specific modules
    './src/modules/tasks/schema/tasks.ts',
  ],
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
