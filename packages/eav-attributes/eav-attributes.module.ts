import { Global, Module, type OnModuleInit } from '@nestjs/common';
import { EAV_STORAGE_EXTENSION } from '@packages/entity-engine/extensions';
import { fieldTypeRegistry } from '@packages/field-types';
import { eavFieldTypesPlugin } from './field-types';
import { FieldValueService } from './services/field-value.service';
import { MultiValueService } from './services/multi-value.service';
import { EavStorageAdapter } from './eav-storage.adapter';

/**
 * EAV Attributes Module — optional dynamic field storage.
 *
 * When imported, provides the EAV_STORAGE_EXTENSION to entity-engine,
 * enabling custom field storage in EAV tables.
 *
 * Without this module, entity-engine works on schema columns only.
 */
@Global()
@Module({
  providers: [
    FieldValueService,
    MultiValueService,
    EavStorageAdapter,
    {
      provide: EAV_STORAGE_EXTENSION,
      useExisting: EavStorageAdapter,
    },
  ],
  exports: [
    FieldValueService,
    MultiValueService,
    EAV_STORAGE_EXTENSION,
  ],
})
export class EavAttributesModule implements OnModuleInit {
  onModuleInit() {
    if (!fieldTypeRegistry.has('picklist')) {
      fieldTypeRegistry.registerPlugin(eavFieldTypesPlugin);
    }
  }
}
