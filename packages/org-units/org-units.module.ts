import { Global, Module, type OnModuleInit } from '@nestjs/common';
import { OrgUnitService } from './services/org-unit.service';
import { OrgUnitController } from './controllers/org-unit.controller';
import { PermissionRegistryService } from '@packages/rbac';
import { LookupResolverService, TEAM_RESOLVER, type TeamResolver } from '@packages/entity-engine';
import { UsersService } from '@packages/users';
import { orgUnits } from './schema/org-units';

@Global()
@Module({
  controllers: [OrgUnitController],
  providers: [
    OrgUnitService,
    {
      provide: TEAM_RESOLVER,
      useFactory: (orgUnitService: OrgUnitService, usersService: UsersService): TeamResolver => ({
        getTeamUserIds: async (userId: string) => {
          const [orgMembers, subordinates] = await Promise.all([
            orgUnitService.getTeamMemberIds(userId),
            usersService.getSelfAndSubordinateIds(userId),
          ]);
          const unique = new Set([...orgMembers, ...subordinates]);
          return Array.from(unique);
        },
      }),
      inject: [OrgUnitService, UsersService],
    },
  ],
  exports: [OrgUnitService, TEAM_RESOLVER],
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
