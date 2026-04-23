import { cleanDatabase, createPackageTestApp, type PackageTestApp } from '@packages/platform-testing';
import { HierarchyModule } from '@packages/hierarchy';
import { OrgUnitsModule } from '@packages/org-units';
import { WorkflowsModule, WorkflowRegistryService } from '@packages/workflows';
import { AuditModule } from '@packages/audit';
import { SettingsModule } from '@packages/settings';
import { NotificationChannelsModule } from '@packages/notification-channels';
import { NotificationsModule } from '@packages/notifications';
import {
  EntityRegistryService,
  WORKFLOW_EXTENSION,
  seedWorkflows,
  type EntityConfig,
} from '@packages/entity-engine';
import { ComplianceDomainModule } from '../../compliance.module';

/**
 * Boots a NestJS HTTP test app with the compliance domain wired up against
 * real Postgres. Imports the transitive platform deps that ComplianceDomainModule
 * expects (hierarchy for laws, org-units for assigneeTeamId, workflows for
 * filing transitions, notifications for task-digest action, etc).
 *
 * UsersModule is intentionally omitted — compliance only uses the
 * USERS_POSITIONS_READER token, which it provides itself; importing the full
 * UsersModule pulls in AuthModule (JWT config, throttling, etc.) which the
 * test harness doesn't need. Tests that need auth use `withAuth([...])`
 * from `@packages/platform-testing` to inject a mock user.
 */
export async function createComplianceTestApp(): Promise<PackageTestApp> {
  const ctx = await createPackageTestApp({
    imports: [
      HierarchyModule,
      WorkflowsModule,
      OrgUnitsModule,
      AuditModule,
      SettingsModule,
      NotificationChannelsModule,
      NotificationsModule,
      ComplianceDomainModule,
    ],
  });

  await seedAllWorkflows(ctx);
  return ctx;
}

/**
 * Seeds workflow definitions from every registered entity config into the DB.
 *
 * The platform's EntityEngineSeedService skips non-adminConfigurable entities
 * (the default), which would leave workflow-backed transitions broken.
 * Calling `seedWorkflows` directly gives transition endpoints the DB rows
 * they read at request time.
 */
async function seedAllWorkflows(ctx: PackageTestApp): Promise<void> {
  const registry = ctx.module.get(EntityRegistryService);
  const workflowExt = ctx.module.get(WORKFLOW_EXTENSION);
  for (const entry of registry.getAll() as EntityConfig[]) {
    await seedWorkflows(entry, workflowExt);
  }
}

/**
 * Truncates all tables and re-seeds workflow defs. Use in `beforeEach` so
 * each test starts from a clean DB but still has the workflow rows the
 * transition endpoint needs.
 *
 * The WorkflowRegistryService caches definitions in memory at boot; after a
 * truncate + reseed the IDs change, so we reload its cache too — otherwise
 * `workflow_transition_history.workflow_definition_id` FK checks against
 * stale cached IDs.
 */
export async function resetComplianceTestDb(ctx: PackageTestApp): Promise<void> {
  await cleanDatabase(ctx.db);
  await seedAllWorkflows(ctx);
  await ctx.module.get(WorkflowRegistryService).loadAll();
}
