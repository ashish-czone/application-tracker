import { Global, Module, type OnModuleInit } from '@nestjs/common';
import { EAV_STORAGE_EXTENSION } from '@packages/entity-engine/extensions';
import { fieldTypeRegistry } from '@packages/field-types';
import { eavFieldTypesPlugin } from './field-types';
import { FieldValueService } from './services/field-value.service';
import { EavStorageAdapter } from './eav-storage.adapter';

/**
 * EAV Attributes Module — optional dynamic field storage.
 *
 * When imported, provides the EAV_STORAGE_EXTENSION to entity-engine,
 * enabling custom field storage in EAV tables.
 *
 * Without this module, entity-engine works on schema columns only.
 *
 * Multi-value relational fields (multi_user, multi_lookup) are handled
 * by @packages/entity-relations, not this module.
 */
@Global()
@Module({
  providers: [
    FieldValueService,
    EavStorageAdapter,
    {
      provide: EAV_STORAGE_EXTENSION,
      useExisting: EavStorageAdapter,
    },
  ],
  exports: [
    FieldValueService,
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
