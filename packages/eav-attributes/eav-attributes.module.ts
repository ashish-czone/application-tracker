import { Global, Module } from '@nestjs/common';
import { FieldDefinitionService } from './services/field-definition.service';
import { LayoutService } from './services/layout.service';
import { FieldValueService } from './services/field-value.service';
import { LookupResolverService } from './services/lookup-resolver.service';

@Global()
@Module({
  providers: [
    FieldDefinitionService,
    LayoutService,
    FieldValueService,
    LookupResolverService,
  ],
  exports: [
    FieldDefinitionService,
    LayoutService,
    FieldValueService,
    LookupResolverService,
  ],
})
export class EavAttributesModule {}
