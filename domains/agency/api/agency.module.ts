import { Module, type OnModuleInit } from '@nestjs/common';
import { RbacIntegrationModule } from '@packages/rbac';
import { AppConfigService } from '@packages/settings';
import { ContentModule } from '@packages/content-api';
import { MediaLibraryModule } from '@packages/media-library-api';
import { PagesModule } from './pages/pages.module';
import { MenusModule } from './menus/menus.module';

import { AGENCY_PERMISSION_MANIFESTS } from './permissions';
import { SITE_SETTINGS } from './settings';
import { SiteSettingsController } from './site-settings.controller';

@Module({
  imports: [
    PagesModule,
    ContentModule,
    MenusModule,
    MediaLibraryModule,
    RbacIntegrationModule.forFeature({ manifests: AGENCY_PERMISSION_MANIFESTS }),
  ],
  controllers: [SiteSettingsController],
})
export class AgencyDomainModule implements OnModuleInit {
  constructor(private readonly appConfig: AppConfigService) {}

  onModuleInit() {
    this.appConfig.register('site', SITE_SETTINGS);
  }
}
