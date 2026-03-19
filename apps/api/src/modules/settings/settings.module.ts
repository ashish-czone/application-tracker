import { Module, type OnModuleInit } from '@nestjs/common';
import { RbacService } from '@packages/rbac';
import { SettingsController } from './controllers/settings.controller';

@Module({
  controllers: [SettingsController],
})
export class SettingsManagementModule implements OnModuleInit {
  constructor(private readonly rbacService: RbacService) {}

  onModuleInit() {
    this.rbacService.registerPermissions('settings', [
      { action: 'read', description: 'View settings' },
      { action: 'manage', description: 'Update settings' },
    ]);
  }
}
