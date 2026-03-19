import { Module, type OnModuleInit } from '@nestjs/common';
import { PermissionRegistryService } from '@packages/rbac';
import { SettingsController } from './controllers/settings.controller';
import { SETTINGS_PERMISSIONS } from './permissions';

@Module({
  controllers: [SettingsController],
})
export class SettingsManagementModule implements OnModuleInit {
  constructor(private readonly permissionRegistry: PermissionRegistryService) {}

  onModuleInit() {
    this.permissionRegistry.register(Object.values(SETTINGS_PERMISSIONS));
  }
}
