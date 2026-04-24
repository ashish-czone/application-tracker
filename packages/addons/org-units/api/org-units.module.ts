import { Global, Module, type OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '@packages/database';
import { OrgUnitService } from './services/org-unit.service';
import { OrgUnitLevelService } from './services/org-unit-level.service';
import { OrgPositionService } from './services/org-position.service';
import { PositionScopeResolverService } from './services/position-scope-resolver.service';
import { OrgUnitController } from './controllers/org-unit.controller';
import { OrgUnitLevelController } from './controllers/org-unit-level.controller';
import { OrgPositionController } from './controllers/org-position.controller';
import { PermissionRegistryService, ScopeResolverRegistry } from '@packages/rbac';
import { LookupResolverService, POSITION_SCOPE_PROVIDER } from '@packages/entity-engine';
import { UserResolverRegistry, EntityResolverRegistry } from '@packages/automation-contracts';
import { orgUnits } from './schema/org-units';
import { OrgUnitHeadStrategy } from './automation-resolvers/org-unit-head.strategy';
import { ParentUnitHeadStrategy } from './automation-resolvers/parent-unit-head.strategy';
import { OrgUnitMembersStrategy } from './automation-resolvers/org-unit-members.strategy';
import { OrgUnitsUserLifecycleListener } from './listeners/org-units-user-lifecycle.listener';
import { UnitScopeResolver, DescendantsScopeResolver } from './scope-resolvers/hierarchy.resolver';

@Global()
@Module({
  controllers: [OrgUnitController, OrgUnitLevelController, OrgPositionController],
  providers: [
    OrgUnitService,
    OrgUnitLevelService,
    OrgPositionService,
    PositionScopeResolverService,
    OrgUnitsUserLifecycleListener,
    UnitScopeResolver,
    DescendantsScopeResolver,
    {
      provide: POSITION_SCOPE_PROVIDER,
      useExisting: PositionScopeResolverService,
    },
  ],
  exports: [OrgUnitService, OrgUnitLevelService, OrgPositionService, PositionScopeResolverService, POSITION_SCOPE_PROVIDER],
})
export class OrgUnitsModule implements OnModuleInit {
  constructor(
    private readonly permissionRegistry: PermissionRegistryService,
    private readonly lookupResolver: LookupResolverService,
    private readonly userResolverRegistry: UserResolverRegistry,
    private readonly entityResolverRegistry: EntityResolverRegistry,
    private readonly database: DatabaseService,
    private readonly scopeResolverRegistry: ScopeResolverRegistry,
    private readonly unitScopeResolver: UnitScopeResolver,
    private readonly descendantsScopeResolver: DescendantsScopeResolver,
  ) {}

  onModuleInit() {
    this.permissionRegistry.register('org-units', [
      { action: 'org-units.read', description: 'View org units' },
      { action: 'org-units.manage', description: 'Create, update, and delete org units' },
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

    // User-resolution strategies for automations. Any entity with an
    // org-unit FK column (e.g. `assigneeTeamId` on tasks) can drive its
    // notification recipients through these.
    const getResolver = (entityType: string) => this.entityResolverRegistry.get(entityType);
    this.userResolverRegistry.registerStrategy(new OrgUnitHeadStrategy(this.database, getResolver));
    this.userResolverRegistry.registerStrategy(new ParentUnitHeadStrategy(this.database, getResolver));
    this.userResolverRegistry.registerStrategy(new OrgUnitMembersStrategy(this.database, getResolver));
  }
}
