import { Module, type OnModuleInit } from '@nestjs/common';
import { RbacService } from '@packages/rbac';
import { AppConfigService } from '@packages/settings';
import { ContentModule } from '@packages/content-api';
import { MenusModule } from '@packages/menus-api';
import { MediaLibraryModule } from '@packages/media-library-api';
import { PagesModule } from './pages/pages.module';

import { AGENCY_PERMISSION_MANIFESTS } from './permissions';
import { SITE_SETTINGS } from './settings';
import { SiteSettingsController } from './site-settings.controller';

@Module({
  imports: [PagesModule, ContentModule, MenusModule, MediaLibraryModule],
  controllers: [SiteSettingsController],
})
export class AgencyDomainModule implements OnModuleInit {
  constructor(
    private readonly rbac: RbacService,
    private readonly appConfig: AppConfigService,
  ) {}

  onModuleInit() {
    this.rbac.registerManifests(AGENCY_PERMISSION_MANIFESTS);
    this.appConfig.register('site', SITE_SETTINGS);
  }
}
