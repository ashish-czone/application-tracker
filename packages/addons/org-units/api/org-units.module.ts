import { Global, Module, type OnModuleInit } from '@nestjs/common';
import { OrgUnitService } from './services/org-unit.service';
import { OrgUnitLevelService } from './services/org-unit-level.service';
import { OrgPositionService } from './services/org-position.service';
import { PositionScopeResolverService } from './services/position-scope-resolver.service';
import { OrgUnitController } from './controllers/org-unit.controller';
import { OrgUnitLevelController } from './controllers/org-unit-level.controller';
import { OrgPositionController } from './controllers/org-position.controller';
import { PermissionRegistryService } from '@packages/rbac';
import { LookupResolverService, POSITION_SCOPE_PROVIDER } from '@packages/entity-engine';
import { orgUnits } from './schema/org-units';

@Global()
@Module({
  controllers: [OrgUnitController, OrgUnitLevelController, OrgPositionController],
  providers: [
    OrgUnitService,
    OrgUnitLevelService,
    OrgPositionService,
    PositionScopeResolverService,
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
  ) {}

  onModuleInit() {
    this.permissionRegistry.register('org-units', [
      { action: 'org-units.read', description: 'View org units' },
      { action: 'org-units.manage', description: 'Create, update, and delete org units' },
    ]);

    this.lookupResolver.register({
      entity: 'org-units',
      table: orgUnits,
      labelField: 'name',
      valueField: 'id',
      searchFields: ['name'],
    });
  }
}
