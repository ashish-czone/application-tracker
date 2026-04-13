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
