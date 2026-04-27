import { Module, type OnModuleInit } from '@nestjs/common';
import { cleanDatabase, createPackageTestApp, type PackageTestApp } from '@packages/platform-testing';
import { HierarchyModule } from '@packages/hierarchy';
import {
  OrgUnitService,
  OrgUnitLevelService,
  OrgPositionService,
  PositionScopeResolverService,
  OrgUnitController,
  OrgUnitLevelController,
  OrgPositionController,
  UnitScopeResolver,
  DescendantsScopeResolver,
  OrgUnitHeadStrategy,
  ParentUnitHeadStrategy,
  OrgUnitMembersStrategy,
  orgUnits,
} from '@packages/org-units';
import { TASK_TEAM_MEMBERS_READER } from '@packages/tasks';
import { DatabaseService } from '@packages/database';
import { PermissionManifestRegistry, ScopeResolverRegistry } from '@packages/rbac';
import { LookupResolverService } from '@packages/entity-engine';
import { UserResolverRegistry, EntityResolverRegistry } from '@packages/automation-contracts';
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

@Module({
  controllers: [OrgUnitController, OrgUnitLevelController, OrgPositionController],
  providers: [
    OrgUnitService,
    OrgUnitLevelService,
    OrgPositionService,
    PositionScopeResolverService,
    UnitScopeResolver,
    DescendantsScopeResolver,
    { provide: TASK_TEAM_MEMBERS_READER, useExisting: OrgUnitService },
  ],
  exports: [
    OrgUnitService,
    OrgUnitLevelService,
    OrgPositionService,
    PositionScopeResolverService,
    TASK_TEAM_MEMBERS_READER,
  ],
})
class TestOrgUnitsModule implements OnModuleInit {
  constructor(
    private readonly manifestRegistry: PermissionManifestRegistry,
    private readonly lookupResolver: LookupResolverService,
    private readonly userResolverRegistry: UserResolverRegistry,
    private readonly entityResolverRegistry: EntityResolverRegistry,
    private readonly database: DatabaseService,
    private readonly scopeResolverRegistry: ScopeResolverRegistry,
    private readonly unitScopeResolver: UnitScopeResolver,
    private readonly descendantsScopeResolver: DescendantsScopeResolver,
  ) {}

  onModuleInit() {
    this.manifestRegistry.registerMany([
      { slug: 'org-units.read',   module: 'org-units', action: 'read',   label: 'View org units',   description: 'View org units',                       supportedScopes: ['any'] },
      { slug: 'org-units.manage', module: 'org-units', action: 'manage', label: 'Manage org units', description: 'Create, update, and delete org units', supportedScopes: ['any'] },
    ]);
    this.scopeResolverRegistry.register(this.unitScopeResolver);
    this.scopeResolverRegistry.register(this.descendantsScopeResolver);
    this.lookupResolver.register({
      entity: 'org-units',
      table: orgUnits,
      labelField: 'name',
      valueField: 'id',
      searchFields: ['name'],
    });
    const getResolver = (entityType: string) => this.entityResolverRegistry.get(entityType);
    this.userResolverRegistry.registerStrategy(new OrgUnitHeadStrategy(this.database, getResolver));
    this.userResolverRegistry.registerStrategy(new ParentUnitHeadStrategy(this.database, getResolver));
    this.userResolverRegistry.registerStrategy(new OrgUnitMembersStrategy(this.database, getResolver));
  }
}

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
      TestOrgUnitsModule,
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
  // Reload registry BEFORE seeding: seedWorkflows' "already seeded?" check
  // consults the in-memory cache (`workflowExt.getBySlug`), which still
  // holds the previous test's stale workflow row after cleanDatabase wiped
  // the DB. Reloading against the now-empty DB clears the cache so
  // seedWorkflows actually re-inserts the rows.
  const workflowRegistry = ctx.module.get(WorkflowRegistryService);
  await workflowRegistry.loadAll();
  await seedAllWorkflows(ctx);
  await workflowRegistry.loadAll();
}
