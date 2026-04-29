import { Global, Module } from '@nestjs/common';
import { RbacIntegrationModule } from '@packages/rbac';
import { AppConfigService } from './services/app-config.service';
import { SettingsStoreService } from './services/settings-store.service';
import { SettingsController } from './controllers/settings.controller';

@Global()
@Module({
  imports: [
    RbacIntegrationModule.forFeature({
      manifests: [
        { slug: 'settings.read',   module: 'settings', action: 'read',   label: 'View settings',   description: 'View settings',   supportedScopes: ['any'] },
        { slug: 'settings.manage', module: 'settings', action: 'manage', label: 'Manage settings', description: 'Update settings', supportedScopes: ['any'] },
      ],
    }),
  ],
  controllers: [SettingsController],
  providers: [SettingsStoreService, AppConfigService],
  exports: [AppConfigService],
})
export class SettingsModule {}
