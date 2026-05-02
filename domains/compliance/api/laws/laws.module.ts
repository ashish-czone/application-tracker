import { Module } from '@nestjs/common';
import { EntityEngineModule } from '@packages/entity-engine';
import { RbacIntegrationModule } from '@packages/rbac';
import { createCrudProvider } from '@packages/crud-base';
import { LAWS_CONFIG } from './laws.config';
import { LAWS_PERMISSION_MANIFESTS } from './laws.permissions';
import { LawsController } from './laws.controller';
import { LawsService } from './laws.service';
import { LAWS_CRUD_TOKEN } from './laws.crud-token';
import { complianceLaws } from './laws.schema';

@Module({
  imports: [
    EntityEngineModule.forEntity(LAWS_CONFIG),
    RbacIntegrationModule.forFeature({ manifests: LAWS_PERMISSION_MANIFESTS }),
  ],
  controllers: [LawsController],
  providers: [
    createCrudProvider(LAWS_CRUD_TOKEN, complianceLaws, {
      slug: 'laws',
      events: {
        created: 'laws.Created',
        updated: 'laws.Updated',
        deleted: 'laws.Deleted',
      },
    }),
    LawsService,
  ],
  exports: [LawsService],
})
export class LawsModule {}
