import path from 'node:path';
import { existsSync } from 'node:fs';
import type { PackageMigrationSource } from '@packages/database';

export function findWorkspaceRoot(start: string): string {
  let dir = start;
  while (dir !== path.dirname(dir)) {
    if (existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  throw new Error(`Could not find pnpm-workspace.yaml above ${start}`);
}

/**
 * Ordered list of platform/core/addon packages whose migrations must run
 * before any domain migrations. Order reflects cross-package FK dependencies:
 * @packages/database (users) first, then everything that references users,
 * then addons that reference platform tables, etc.
 */
export function platformMigrationSources(
  workspaceRoot: string,
): PackageMigrationSource[] {
  const at = (rel: string, name: string): PackageMigrationSource => ({
    name,
    migrationsFolder: path.join(workspaceRoot, rel, 'migrations'),
  });

  return [
    // Core — owns users; everything else FK-references it.
    at('packages/core/database', '@packages/database'),

    // Platform — base infra that other tiers depend on.
    at('packages/platform/rbac/api', '@packages/rbac'),
    at('packages/platform/auth/api', '@packages/auth'),
    at('packages/platform/settings/api', '@packages/settings'),
    at('packages/platform/audit/api', '@packages/audit'),
    at('packages/platform/notification-channels/api', '@packages/notification-channels'),
    at('packages/platform/notifications/api', '@packages/notifications'),
    at('packages/platform/automations/api', '@packages/automations'),
    at('packages/platform/workflows/api', '@packages/workflows'),
    at('packages/platform/taxonomy/api', '@packages/taxonomy'),
    at('packages/platform/user-preferences', '@packages/user-preferences'),
    at('packages/platform/entity-engine/api', '@packages/entity-engine'),
    at('packages/platform/entity-layout/api', '@packages/entity-layout'),
    at('packages/platform/hierarchy', '@packages/hierarchy'),

    // Addons — depend on core + platform.
    at('packages/addons/tenancy', '@packages/tenancy'),
    at('packages/addons/eav-attributes', '@packages/eav-attributes'),
    at('packages/addons/entity-relations', '@packages/entity-relations'),
    at('packages/addons/org-units/api', '@packages/org-units'),
    at('packages/addons/tasks/api', '@packages/tasks'),
    at('packages/addons/notes', '@packages/notes'),
    at('packages/addons/attachments', '@packages/attachments'),
    at('packages/addons/evaluations', '@packages/evaluations'),
    at('packages/addons/document-templates', '@packages/document-templates'),
    at('packages/addons/orders-billing', '@packages/orders-billing'),
    at('packages/addons/orders-subscriptions', '@packages/orders-subscriptions'),
  ];
}
