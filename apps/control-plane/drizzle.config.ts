import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: [
    // Core infrastructure
    '../../packages/database/schema/index.ts',
    '../../packages/auth/schema/index.ts',
    '../../packages/rbac/schema/index.ts',
    '../../packages/settings/schema/index.ts',
    // Transitive dependencies (required by UsersModule)
    '../../packages/notification-channels/schema/notifications.ts',
    '../../packages/automations/schema/index.ts',
    '../../packages/notifications/schema/index.ts',
    '../../packages/workflows/schema/index.ts',
    '../../packages/taxonomy/schema/index.ts',
    '../../packages/audit/schema/index.ts',
    '../../packages/entity-engine/schema/index.ts',
    // Billing + Subscriptions
    '../../packages/orders-billing/schema/index.ts',
    '../../packages/orders-subscriptions/schema/index.ts',
    // Control-plane specific
    '../../packages/tenancy/schema/index.ts',
    './src/modules/clients/schema/clients.ts',
  ],
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
