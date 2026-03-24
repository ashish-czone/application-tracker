import { Module, type OnModuleInit } from '@nestjs/common';
import { RbacService } from '@packages/rbac';
import { LayoutsController } from './controllers/layouts.controller';
import { FieldsController } from './controllers/fields.controller';
import { LookupsController } from './controllers/lookups.controller';
import { TagsController } from './controllers/tags.controller';

@Module({
  controllers: [LayoutsController, FieldsController, LookupsController, TagsController],
})
export class EavManagementModule implements OnModuleInit {
  constructor(private readonly rbacService: RbacService) {}

  onModuleInit() {
    this.rbacService.registerPermissions('eav', [
      { action: 'read', description: 'View field definitions and layouts' },
      { action: 'manage', description: 'Create/update/delete custom fields and layouts' },
    ]);
  }
}
