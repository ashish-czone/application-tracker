import { Global, Module } from '@nestjs/common';
import { MULTI_VALUE_EXTENSION } from '@packages/entity-engine/extensions';
import { MultiValueService } from './services/multi-value.service';

/**
 * Entity Relations Module — generic multi-value junction table for relational fields.
 *
 * Provides the MULTI_VALUE_EXTENSION to entity-engine plus the public
 * MultiValueService that per-entity domain services compose with
 * directly to write `multi_user` / `multi_lookup` field rows inside
 * their own transactions.
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
export class EntityRelationsModule {}
