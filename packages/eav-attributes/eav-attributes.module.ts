import { Global, Module } from '@nestjs/common';
import { FieldValueService } from './services/field-value.service';
import { MultiValueService } from './services/multi-value.service';

/**
 * EAV Attributes Module — optional dynamic field storage.
 *
 * Provides FieldValueService and MultiValueService for storing/retrieving
 * custom field values in EAV tables (entity_field_values, entity_multi_values).
 *
 * Core services (FieldDefinitionService, LookupResolverService) are now in @packages/entity-engine.
 * Layout services are now in @packages/entity-layout.
 */
@Global()
@Module({
  providers: [FieldValueService, MultiValueService],
  exports: [FieldValueService, MultiValueService],
})
export class EavAttributesModule {}
