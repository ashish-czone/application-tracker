import { defineConfig } from 'drizzle-kit';

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
    // Recruit domain
    '../../domains/recruit/api/clients/schema/clients.ts',
    '../../domains/recruit/api/contacts/schema/contacts.ts',
    '../../domains/recruit/api/vendors/schema/vendors.ts',
    '../../domains/recruit/api/candidates/schema/candidates.ts',
    '../../domains/recruit/api/job-openings/schema/job-openings.ts',
    '../../domains/recruit/api/applications/schema/applications.ts',
    '../../domains/recruit/api/interviews/schema/interviews.ts',
    '../../domains/recruit/api/offers/schema/offers.ts',
    // Compliance domain (shared migration folder until per-domain split lands)
    '../../domains/compliance/api/schema/index.ts',
  ],
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
