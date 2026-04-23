import { createPackageTestApp, type PackageTestApp } from '@packages/platform-testing';
import { HierarchyModule } from '@packages/hierarchy';
import { OrgUnitsModule } from '@packages/org-units';
import { WorkflowsModule } from '@packages/workflows';
import { AuditModule } from '@packages/audit';
import { SettingsModule } from '@packages/settings';
import { NotificationChannelsModule } from '@packages/notification-channels';
import { NotificationsModule } from '@packages/notifications';
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
  return createPackageTestApp({
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
}
