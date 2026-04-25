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
    '../../packages/addons/workflows/api/schema/index.ts',
    '../../packages/platform/taxonomy/api/schema/index.ts',
    '../../packages/platform/entity-engine/api/schema/index.ts',
    // Addon packages
    '../../packages/addons/orders-billing/schema/index.ts',
    '../../packages/addons/orders-subscriptions/schema/index.ts',
    '../../packages/addons/tenancy/schema/index.ts',
    // Control-plane specific
    './src/modules/clients/schema/clients.ts',
  ],
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
