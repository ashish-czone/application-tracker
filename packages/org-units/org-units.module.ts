import { Global, Module, type OnModuleInit } from '@nestjs/common';
import { OrgUnitService } from './services/org-unit.service';
import { OrgUnitController } from './controllers/org-unit.controller';
import { PermissionRegistryService } from '@packages/rbac';

@Global()
@Module({
  controllers: [OrgUnitController],
  providers: [OrgUnitService],
  exports: [OrgUnitService],
})
export class OrgUnitsModule implements OnModuleInit {
  constructor(private readonly permissionRegistry: PermissionRegistryService) {}

  onModuleInit() {
    this.permissionRegistry.register('org-units', [
      { action: 'org-units.read', description: 'View org units' },
      { action: 'org-units.manage', description: 'Create, update, and delete org units' },
    ]);
  }
}
