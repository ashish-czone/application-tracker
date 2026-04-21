import { Module, type OnModuleInit } from '@nestjs/common';
import { RbacService } from '@packages/rbac';
import { PagesModule } from '@packages/pages-api';

import { AGENCY_PERMISSION_REGISTRATIONS } from './permissions';

@Module({
  imports: [PagesModule],
})
export class AgencyDomainModule implements OnModuleInit {
  constructor(private readonly rbac: RbacService) {}

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
  }
}
