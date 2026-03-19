import { Module, type OnModuleInit } from '@nestjs/common';
import { TaxonomyModule as TaxonomyPackageModule, TaxonomyService } from '@packages/taxonomy';
import { RbacService } from '@packages/rbac';
import { TagsController } from './controllers/tags.controller';

@Module({
  imports: [TaxonomyPackageModule],
  controllers: [TagsController],
})
export class TaxonomyManagementModule implements OnModuleInit {
  constructor(private readonly rbacService: RbacService) {}

  onModuleInit() {
    this.rbacService.registerPermissions('taxonomy', [
      { action: 'tag-groups.read', description: 'View tag groups' },
      { action: 'tag-groups.manage', description: 'Create, update, and delete tag groups' },
      { action: 'tags.read', description: 'View tags' },
      { action: 'tags.manage', description: 'Create, update, and delete tags' },
    ]);
  }
}
