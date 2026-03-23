import { Module, Global } from '@nestjs/common';
import { EntityRegistryService } from './entity-registry.service';

/**
 * Core entity engine module.
 * Import this ONCE in the root app module — it provides the global EntityRegistryService.
 *
 * To register entities, use EntityEngineModule.forEntity(config) in subsequent tasks.
 * For now, this module only provides the registry.
 */
@Global()
@Module({
  providers: [EntityRegistryService],
  exports: [EntityRegistryService],
})
export class EntityEngineModule {}
