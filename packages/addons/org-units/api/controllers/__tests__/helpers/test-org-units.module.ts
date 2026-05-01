import { Module, type OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '@packages/database';
import { PermissionManifestRegistry, ScopeResolverRegistry } from '@packages/rbac';
import { UserResolverRegistry, EntityResolverRegistry } from '@packages/automation-contracts';
import { OrgUnitService } from '../../../services/org-unit.service';
import { OrgUnitLevelService } from '../../../services/org-unit-level.service';
import { OrgPositionService } from '../../../services/org-position.service';
import { PositionScopeResolverService } from '../../../services/position-scope-resolver.service';
import { OrgUnitController } from '../../org-unit.controller';
import { OrgUnitLevelController } from '../../org-unit-level.controller';
import { OrgPositionController } from '../../org-position.controller';
import {
  UnitScopeResolver,
  DescendantsScopeResolver,
} from '../../../scope-resolvers/hierarchy.resolver';
import { OrgUnitHeadStrategy } from '../../../automation-resolvers/org-unit-head.strategy';
import { ParentUnitHeadStrategy } from '../../../automation-resolvers/parent-unit-head.strategy';
import { OrgUnitMembersStrategy } from '../../../automation-resolvers/org-unit-members.strategy';

/**
 * Mirrors the app-level `OrgUnitsModule` apps build on top of `@packages/org-units`.
 * The library doesn't ship a NestJS module — each app composes one. Tests need
 * the same composition, so this module is the test harness equivalent.
 *
 * Org-units does NOT participate in entity-engine's lookup-resolver registry
 * here. Apps that want an org-unit picker dropdown for entity-engine entities
 * register it themselves at the app layer; that's their integration concern,
 * not org-units'.
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
  exports: [OrgUnitService, OrgUnitLevelService, OrgPositionService, PositionScopeResolverService],
})
export class TestOrgUnitsModule implements OnModuleInit {
  constructor(
    private readonly manifestRegistry: PermissionManifestRegistry,
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

    const getResolver = (entityType: string) => this.entityResolverRegistry.get(entityType);
    this.userResolverRegistry.registerStrategy(new OrgUnitHeadStrategy(this.database, getResolver));
    this.userResolverRegistry.registerStrategy(new ParentUnitHeadStrategy(this.database, getResolver));
    this.userResolverRegistry.registerStrategy(new OrgUnitMembersStrategy(this.database, getResolver));
  }
}
