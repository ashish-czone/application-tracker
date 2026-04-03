import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: [
    // Shared infrastructure
    '../../packages/database/schema/index.ts',
    '../../packages/auth/schema/index.ts',
    '../../packages/rbac/schema/index.ts',
    '../../packages/settings/schema/index.ts',
    '../../packages/notification-channels/schema/notifications.ts',
    '../../packages/automations/schema/index.ts',
    '../../packages/notifications/schema/index.ts',
    '../../packages/workflows/schema/index.ts',
    '../../packages/taxonomy/schema/index.ts',
    '../../packages/audit/schema/index.ts',
    '../../packages/tasks/schema/tasks.ts',
    '../../packages/notes/schema/index.ts',
    '../../packages/attachments/schema/index.ts',
  ],
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
