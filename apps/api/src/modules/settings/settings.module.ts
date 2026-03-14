import { Module, type OnModuleInit } from '@nestjs/common';
import { PermissionRegistryService } from '@packages/rbac-nestjs';
import { SettingsController } from './controllers/settings.controller';

@Module({
  controllers: [SettingsController],
})
export class SettingsModule implements OnModuleInit {
  constructor(private readonly permissionRegistry: PermissionRegistryService) {}

  onModuleInit() {
    this.permissionRegistry.register('settings', [
      { action: 'read', description: 'View platform settings' },
      { action: 'manage', description: 'Modify platform settings' },
    ]);
  }
}
