import type { INestApplicationContext } from '@nestjs/common';
import { EntityEngineSeedService } from '../services/entity-engine-seed.service';

/**
 * System seed for @packages/entity-engine.
 *
 * Writes field definitions, picklist options, default layouts, and workflow
 * definitions/states/transitions for every entity registered via
 * `EntityEngineModule.forEntity(...)`. These rows are peer-to-migrations:
 * without them the platform has no field metadata to drive forms, filters,
 * layouts or state transitions.
 *
 * Runs against the entity registry populated at AppModule boot, so every
 * domain that imports its entity modules is covered automatically.
 */
export const seedSystem = async (ctx: INestApplicationContext): Promise<void> => {
  const seedService = ctx.get(EntityEngineSeedService);
  await seedService.seedAll();
};
