import { defineConfig } from 'drizzle-kit';

// NOTE: compliance currently shares apps/recruit/drizzle/ as its migrations folder.
// Each app runs the same migration set against its own DATABASE_URL.
// Proper per-domain migration split (platform → packages/core/database/migrations,
// recruit-specific → domains/recruit/api/drizzle, compliance → domains/compliance/api/drizzle)
// is deferred to a follow-up PR.
export default defineConfig({
  schema: [
    // Core packages
    '../../packages/core/database/schema/index.ts',
    '../../packages/platform/auth/api/schema/index.ts',
    '../../packages/platform/rbac/api/schema/index.ts',
    '../../packages/platform/settings/api/schema/index.ts',
    '../../packages/platform/audit/api/schema/index.ts',
    // Platform packages
    '../../packages/platform/notification-channels/schema/notifications.ts',
    '../../packages/platform/automations/api/schema/index.ts',
    '../../packages/platform/notifications/api/schema/index.ts',
    '../../packages/platform/workflows/api/schema/index.ts',
    '../../packages/platform/taxonomy/api/schema/index.ts',
    '../../packages/platform/user-preferences/schema/index.ts',
    // Addon packages
    '../../packages/addons/org-units/api/schema/index.ts',
    '../../packages/addons/eav-attributes/schema/index.ts',
    '../../packages/addons/entity-relations/schema/index.ts',
    '../../packages/addons/tasks/schema/tasks.ts',
    '../../packages/addons/notes/schema/index.ts',
    '../../packages/addons/evaluations/schema/index.ts',
    '../../packages/addons/attachments/schema/index.ts',
    // Compliance domain
    '../../domains/compliance/api/schema/index.ts',
  ],
  out: '../recruit/drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
