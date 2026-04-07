import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: [
    // Shared infrastructure (from packages)
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
    '../../packages/eav-attributes/schema/index.ts',
    '../../packages/entity-relations/schema/index.ts',
    '../../packages/tasks/schema/tasks.ts',
    '../../packages/notes/schema/index.ts',
    '../../packages/drafts/schema/index.ts',
    '../../packages/evaluations/schema/index.ts',
    '../../packages/attachments/schema/index.ts',
    // Recruit-specific modules
    './src/modules/clients/schema/clients.ts',
    './src/modules/contacts/schema/contacts.ts',
    './src/modules/vendors/schema/vendors.ts',
    './src/modules/candidates/schema/candidates.ts',
    './src/modules/job-openings/schema/job-openings.ts',
    './src/modules/applications/schema/applications.ts',
    './src/modules/interviews/schema/interviews.ts',
  ],
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
