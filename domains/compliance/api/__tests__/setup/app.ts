import { Module, type OnModuleInit } from '@nestjs/common';
import {
  cleanDatabase,
  createTestApp,
  type TestAppContext,
} from '@packages/platform-testing';
import { hierarchyAddon, HierarchyModule } from '@packages/hierarchy';
import { workflowsAddon } from '@packages/workflows';
import { WorkflowsEntityEngineModule } from '@packages/workflows-entity-engine';
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
import { DatabaseService } from '@packages/database';
import { PermissionManifestRegistry, ScopeResolverRegistry } from '@packages/rbac';
import { LookupResolverService } from '@packages/entity-engine';
import { UserResolverRegistry, EntityResolverRegistry } from '@packages/automation-contracts';
import { WorkflowRegistryService } from '@packages/workflows';
import { complianceBackend } from '../../index';

/**
 * Test-side mirror of `apps/compliance/src/modules/org-units/org-units.module.ts`.
 * No `@Global()` and no `TASK_TEAM_MEMBERS_READER` binding: TasksModule is no
 * longer loaded in compliance (the domain doesn't inject `TasksService`), so
 * the token isn't needed in this test app.
 */
@Module({
  controllers: [OrgUnitController, OrgUnitLevelController, OrgPositionController],
  providers: [
    OrgUnitService,
    OrgUnitLevelService,
    OrgPositionService,
    PositionScopeResolverService,
    UnitScopeResolver,
    DescendantsScopeResolver,
  ],
  exports: [
    OrgUnitService,
    OrgUnitLevelService,
    OrgPositionService,
    PositionScopeResolverService,
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
 * real Postgres. Uses `createTestApp` from `@packages/platform-testing` which
 * mirrors the shell composition `apps/compliance` uses at runtime — same
 * EntityEngineModule, WorkflowsModule, AuditModule, etc. — so domain code
 * resolves the same DI graph in tests as in production.
 *
 * `extraImports` mirrors what `apps/compliance/src/app.module.ts` passes to
 * `createAppModule`, scoped down to what compliance integration tests
 * actually exercise:
 *  - `HierarchyModule` for laws (laws are hierarchical via the platform flag)
 *  - `TestOrgUnitsModule` for assigneeTeamId and escalation resolvers.
 *    UsersModule is intentionally omitted — compliance only uses the
 *    `USERS_POSITIONS_READER` token, which it provides itself.
 */
export async function createComplianceTestApp(): Promise<TestAppContext> {
  return createTestApp({
    domains: [complianceBackend],
    addons: [workflowsAddon, hierarchyAddon],
    extraImports: [WorkflowsEntityEngineModule, TestOrgUnitsModule],
  });
}

/**
 * Truncates all tables. Use in `beforeEach` so each test starts from a
 * clean DB.
 *
 * Compliance's workflow definitions are code-defined (registered via
 * `WorkflowsModule.forFeature(...)` at module init) and live in the
 * `WorkflowRegistryService` in-memory cache for the lifetime of the test
 * app. They survive `cleanDatabase` because they are never DB rows.
 * `loadAll()` is still called so any admin-defined workflows the test
 * created itself are dropped from the cache before the next test runs.
 */
export async function resetComplianceTestDb(ctx: TestAppContext): Promise<void> {
  await cleanDatabase(ctx.db);
  const workflowRegistry = ctx.module.get(WorkflowRegistryService);
  await workflowRegistry.loadAll();
}
