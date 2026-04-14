import type { INestApplicationContext } from '@nestjs/common';
import { OrgPositionService } from '../services/org-position.service';
import { OrgUnitLevelService } from '../services/org-unit-level.service';

/**
 * System seed for @packages/org-units.
 *
 * These rows are peer-to-migrations: without them, org-unit creation
 * (which requires a level) and member assignment (which requires a
 * position) cannot function. A consumer app cannot opt out.
 *
 * Seed functions live here rather than in `onModuleInit` so the
 * db:seed CLI owns lifecycle — nothing is created implicitly at
 * app boot.
 */
export const seedSystem = async (ctx: INestApplicationContext): Promise<void> => {
  const positionService = ctx.get(OrgPositionService);
  const levelService = ctx.get(OrgUnitLevelService);

  await positionService.seedDefaults();
  await levelService.seedDefaults();
};
