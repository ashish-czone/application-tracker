import { Global, Module, type OnModuleInit, Optional, Inject } from '@nestjs/common';
import { EAV_STORAGE_EXTENSION } from '@packages/entity-engine/extensions';
import { FieldTypeSaveHookRegistry } from '@packages/entity-engine';
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
  constructor(
    private readonly multiValueService: MultiValueService,
    @Optional() @Inject(FieldTypeSaveHookRegistry) private readonly hookRegistry?: FieldTypeSaveHookRegistry,
  ) {}

  onModuleInit() {
    if (!fieldTypeRegistry.has('picklist')) {
      fieldTypeRegistry.registerPlugin(eavFieldTypesPlugin);
    }

    // Register multi-value save hooks for multi_user and multi_lookup
    if (this.hookRegistry) {
      const multiValueHook = {
        onTransactionalSave: async (value: unknown, ctx: any, tx: any) => {
          if (!Array.isArray(value)) return;
          const targetIds = value.filter((v): v is string => typeof v === 'string');
          await this.multiValueService.setValues(ctx.entityType, ctx.entityId, ctx.fieldKey, targetIds, tx);
        },
      };
      if (!this.hookRegistry.has('multi_user')) {
        this.hookRegistry.register('multi_user', multiValueHook);
      }
      if (!this.hookRegistry.has('multi_lookup')) {
        this.hookRegistry.register('multi_lookup', multiValueHook);
      }
    }
  }
}
