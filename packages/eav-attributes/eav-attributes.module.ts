import { Global, Module, type OnModuleInit } from '@nestjs/common';
import { RbacService } from '@packages/rbac';
import { FieldDefinitionService } from './services/field-definition.service';
import { LayoutService } from './services/layout.service';
import { FieldValueService } from './services/field-value.service';
import { LookupResolverService } from './services/lookup-resolver.service';
import { MultiValueService } from './services/multi-value.service';
import { FieldsController } from './controllers/fields.controller';
import { LayoutsController } from './controllers/layouts.controller';
import { LookupsController } from './controllers/lookups.controller';

@Global()
@Module({
  controllers: [FieldsController, LayoutsController, LookupsController],
  providers: [
    FieldDefinitionService,
    LayoutService,
    FieldValueService,
    LookupResolverService,
    MultiValueService,
  ],
  exports: [
    FieldDefinitionService,
    LayoutService,
    FieldValueService,
    LookupResolverService,
    MultiValueService,
  ],
})
export class EavAttributesModule implements OnModuleInit {
  constructor(private readonly rbacService: RbacService) {}

  onModuleInit() {
    this.rbacService.registerPermissions('eav', [
      { action: 'read', description: 'View field definitions and layouts' },
      { action: 'manage', description: 'Create/update/delete custom fields and layouts' },
    ]);
  }
}
