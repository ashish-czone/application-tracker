import { Global, Module, type OnModuleInit } from '@nestjs/common';
import { MULTI_VALUE_EXTENSION } from '@packages/entity-engine/extensions';
import { fieldTypeSaveHookRegistry } from '@packages/entity-engine';
import { MultiValueService } from './services/multi-value.service';

/**
 * Entity Relations Module — generic multi-value junction table for relational fields.
 *
 * Provides the MULTI_VALUE_EXTENSION to entity-engine, enabling multi_user and
 * multi_lookup field types that store multiple target references per entity field.
 *
 * Without this module, multi_user/multi_lookup fields are unavailable.
 */
@Global()
@Module({
  providers: [
    MultiValueService,
    {
      provide: MULTI_VALUE_EXTENSION,
      useFactory: (svc: MultiValueService) => ({
        setMultiValues: svc.setValues.bind(svc),
        getAllMultiValues: svc.getAllForEntity.bind(svc),
      }),
      inject: [MultiValueService],
    },
  ],
  exports: [
    MultiValueService,
    MULTI_VALUE_EXTENSION,
  ],
})
export class EntityRelationsModule implements OnModuleInit {
  constructor(
    private readonly multiValueService: MultiValueService,
  ) {}

  onModuleInit() {
    // Register multi-value save hooks for multi_user and multi_lookup
    const multiValueHook = {
      onTransactionalSave: async (value: unknown, ctx: any, tx: any) => {
        if (!Array.isArray(value)) return;
        const targetIds = value.filter((v): v is string => typeof v === 'string');
        await this.multiValueService.setValues(ctx.entityType, ctx.entityId, ctx.fieldKey, targetIds, tx);
      },
    };
    if (!fieldTypeSaveHookRegistry.has('multi_user')) {
      fieldTypeSaveHookRegistry.register('multi_user', multiValueHook);
    }
    if (!fieldTypeSaveHookRegistry.has('multi_lookup')) {
      fieldTypeSaveHookRegistry.register('multi_lookup', multiValueHook);
    }
  }
}
