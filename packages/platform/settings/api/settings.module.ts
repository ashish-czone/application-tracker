import { Global, Module, type OnModuleInit } from '@nestjs/common';
import { RbacService } from '@packages/rbac';
import { AppConfigService } from './services/app-config.service';
import { SettingsStoreService } from './services/settings-store.service';
import { SettingsController } from './controllers/settings.controller';

@Global()
@Module({
  controllers: [SettingsController],
  providers: [SettingsStoreService, AppConfigService],
  exports: [AppConfigService],
})
export class SettingsModule implements OnModuleInit {
  constructor(private readonly rbacService: RbacService) {}

  onModuleInit() {
    this.rbacService.registerManifests([
      { slug: 'settings.read',   module: 'settings', action: 'read',   label: 'View settings',   description: 'View settings',   supportedScopes: ['any'] },
      { slug: 'settings.manage', module: 'settings', action: 'manage', label: 'Manage settings', description: 'Update settings', supportedScopes: ['any'] },
    ]);
  }
}
