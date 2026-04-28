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

const KERNEL_PACKAGE_FOLDERS = {
  '@packages/database': 'packages/core/database',
  '@packages/rbac': 'packages/platform/rbac/api',
  '@packages/auth': 'packages/platform/auth/api',
  '@packages/settings': 'packages/platform/settings/api',
  '@packages/audit': 'packages/platform/audit/api',
  '@packages/notification-channels': 'packages/platform/notification-channels/api',
  '@packages/notifications': 'packages/platform/notifications/api',
  '@packages/user-preferences': 'packages/platform/user-preferences',
  '@packages/entity-engine': 'packages/platform/entity-engine/api',
  '@packages/entity-layout': 'packages/platform/entity-layout/api',
} as const satisfies Record<string, string>;

const OPT_IN_PACKAGE_FOLDERS = {
  '@packages/automations': 'packages/addons/automations/api',
  '@packages/workflows': 'packages/addons/workflows/api',
  '@packages/taxonomy': 'packages/addons/taxonomy/api',
  '@packages/hierarchy': 'packages/addons/hierarchy/api',
  '@packages/tenancy': 'packages/addons/tenancy',
  '@packages/eav-attributes': 'packages/addons/eav-attributes',
  '@packages/entity-relations': 'packages/addons/entity-relations/api',
  '@packages/org-units': 'packages/addons/org-units/api',
  '@packages/tasks': 'packages/addons/tasks/api',
  '@packages/notes': 'packages/addons/notes/api',
  '@packages/attachments': 'packages/addons/attachments/api',
  '@packages/directory': 'packages/addons/directory/api',
  '@packages/evaluations': 'packages/addons/evaluations/api',
  '@packages/document-templates': 'packages/addons/document-templates/api',
  '@packages/orders-billing': 'packages/addons/orders-billing',
  '@packages/orders-subscriptions': 'packages/addons/orders-subscriptions',
  '@packages/media-library-api': 'packages/addons/media-library/api',
  '@packages/content-api': 'packages/addons/content/api',
} as const satisfies Record<string, string>;

type KernelPackageName = keyof typeof KERNEL_PACKAGE_FOLDERS;

/**
 * Names of opt-in addon/platform packages whose migrations an app may include.
 * Pass these to `packageMigration()` — only modules the app actually imports
 * should appear, so the database has no orphan tables.
 */
export type PackageMigrationName = keyof typeof OPT_IN_PACKAGE_FOLDERS;

function pkg(
  workspaceRoot: string,
  name: KernelPackageName | PackageMigrationName,
): PackageMigrationSource {
  const folder =
    (KERNEL_PACKAGE_FOLDERS as Record<string, string>)[name] ??
    (OPT_IN_PACKAGE_FOLDERS as Record<string, string>)[name];
  if (!folder) {
    throw new Error(`Unknown migration package: ${name}`);
  }
  return {
    name,
    migrationsFolder: path.join(workspaceRoot, folder, 'migrations'),
  };
}

/**
 * Packages that are loaded by `createAppModule` for every app, regardless of
 * whether the app explicitly imports them. Their migrations must run on every
 * app's database. Order reflects cross-package FK dependencies.
 *
 * `@packages/automations` and `@packages/workflows` are addons — they're
 * opt-in here even though apps that use them must add the corresponding
 * addon to their addons array.
 */
export function kernelMigrationSources(workspaceRoot: string): PackageMigrationSource[] {
  return [
    pkg(workspaceRoot, '@packages/database'),
    pkg(workspaceRoot, '@packages/rbac'),
    pkg(workspaceRoot, '@packages/auth'),
    pkg(workspaceRoot, '@packages/settings'),
    pkg(workspaceRoot, '@packages/audit'),
    pkg(workspaceRoot, '@packages/notification-channels'),
    pkg(workspaceRoot, '@packages/notifications'),
    pkg(workspaceRoot, '@packages/user-preferences'),
    pkg(workspaceRoot, '@packages/entity-engine'),
    pkg(workspaceRoot, '@packages/entity-layout'),
  ];
}

/**
 * Resolves an opt-in package's migration folder. Use in an app's `migrate.ts`
 * after spreading `kernelMigrationSources()`. Order matters when one opt-in
 * package FK-references another — e.g. `@packages/tasks` references
 * `org_units`, so list `@packages/org-units` first.
 */
export function packageMigration(
  workspaceRoot: string,
  name: PackageMigrationName,
): PackageMigrationSource {
  return pkg(workspaceRoot, name);
}

/**
 * Convenience for test environments that genuinely need every package's
 * migrations (e.g. an integration-test app that exercises every addon).
 * Production apps should NOT use this — declare only what they import via
 * `packageMigration()`.
 */
export function allMigrationSources(workspaceRoot: string): PackageMigrationSource[] {
  return [
    ...kernelMigrationSources(workspaceRoot),
    // Order chosen to satisfy FK dependencies between opt-in packages.
    // automations + workflows must come before any addon whose schema
    // references workflow_definitions (e.g. tasks, notes, evaluations all
    // can attach a workflow to their entity).
    pkg(workspaceRoot, '@packages/automations'),
    pkg(workspaceRoot, '@packages/workflows'),
    pkg(workspaceRoot, '@packages/taxonomy'),
    pkg(workspaceRoot, '@packages/hierarchy'),
    pkg(workspaceRoot, '@packages/tenancy'),
    pkg(workspaceRoot, '@packages/eav-attributes'),
    pkg(workspaceRoot, '@packages/entity-relations'),
    pkg(workspaceRoot, '@packages/org-units'),
    pkg(workspaceRoot, '@packages/tasks'),
    pkg(workspaceRoot, '@packages/notes'),
    pkg(workspaceRoot, '@packages/attachments'),
    pkg(workspaceRoot, '@packages/evaluations'),
    pkg(workspaceRoot, '@packages/document-templates'),
    pkg(workspaceRoot, '@packages/orders-billing'),
    pkg(workspaceRoot, '@packages/orders-subscriptions'),
    pkg(workspaceRoot, '@packages/media-library-api'),
    pkg(workspaceRoot, '@packages/content-api'),
  ];
}

