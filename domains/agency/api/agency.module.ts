import { Module, type OnModuleInit } from '@nestjs/common';
import { RbacService } from '@packages/rbac';
import { AppConfigService } from '@packages/settings';
import { PagesModule } from '@packages/pages-api';
import { ContentModule } from '@packages/content-api';
import { MenusModule } from '@packages/menus-api';

import { AGENCY_PERMISSION_REGISTRATIONS } from './permissions';
import { SITE_SETTINGS } from './settings';

@Module({
  imports: [PagesModule, ContentModule, MenusModule],
})
export class AgencyDomainModule implements OnModuleInit {
  constructor(
    private readonly rbac: RbacService,
    private readonly appConfig: AppConfigService,
  ) {}

  onModuleInit() {
    const byModule = new Map<string, { action: string; description: string }[]>();
    for (const { module, action, description } of AGENCY_PERMISSION_REGISTRATIONS) {
      const list = byModule.get(module) ?? [];
      list.push({ action, description });
      byModule.set(module, list);
    }
    for (const [module, perms] of byModule) {
      this.rbac.registerPermissions(module, perms);
    }

    this.appConfig.register('site', SITE_SETTINGS);
  }
}
