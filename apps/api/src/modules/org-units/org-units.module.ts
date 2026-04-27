import { Module, type OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '@packages/database';
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
import { PermissionManifestRegistry, ScopeResolverRegistry } from '@packages/rbac';
import { LookupResolverService } from '@packages/entity-engine';
import { UserResolverRegistry, EntityResolverRegistry } from '@packages/automation-contracts';

/**
 * App-level org-units module. Wires the library classes into NestJS DI and
 * registers the cross-cutting bindings (permissions, scope resolvers, lookup,
 * automation strategies) the app participates in. Mirrors the users-as-library
 * pattern — `@packages/org-units` ships only classes/configs.
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
export class OrgUnitsModule implements OnModuleInit {
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
