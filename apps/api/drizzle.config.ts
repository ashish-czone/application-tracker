import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: [
    // Core packages
    '../../packages/core/database/schema/index.ts',
    '../../packages/core/auth/schema/index.ts',
    '../../packages/core/rbac/schema/index.ts',
    '../../packages/core/settings/schema/index.ts',
    '../../packages/core/audit/schema/index.ts',
    // Platform packages
    '../../packages/platform/notification-channels/schema/notifications.ts',
    '../../packages/platform/automations/schema/index.ts',
    '../../packages/platform/notifications/schema/index.ts',
    '../../packages/platform/workflows/schema/index.ts',
    '../../packages/platform/taxonomy/schema/index.ts',
    // Addon packages
    '../../packages/addons/org-units/schema/index.ts',
    '../../packages/addons/eav-attributes/schema/index.ts',
    '../../packages/addons/entity-relations/schema/index.ts',
    '../../packages/addons/tasks/schema/tasks.ts',
    '../../packages/addons/notes/schema/index.ts',
    '../../packages/addons/evaluations/schema/index.ts',
    '../../packages/addons/attachments/schema/index.ts',
    '../../packages/addons/document-templates/schema/index.ts',
  ],
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
