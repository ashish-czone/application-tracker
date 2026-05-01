import { Module } from '@nestjs/common';
import { EntityEngineModule } from '@packages/entity-engine';
import { RbacIntegrationModule } from '@packages/rbac';
import { LAWS_CONFIG } from './laws.config';
import { LAWS_PERMISSION_MANIFESTS } from './laws.permissions';
import { LawsController } from './laws.controller';
import { LawsService } from './laws.service';

@Module({
  imports: [
    EntityEngineModule.forEntity(LAWS_CONFIG),
    RbacIntegrationModule.forFeature({ manifests: LAWS_PERMISSION_MANIFESTS }),
  ],
  controllers: [LawsController],
  providers: [LawsService],
  exports: [LawsService],
})
export class LawsModule {}
