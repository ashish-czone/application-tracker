import { Module } from '@nestjs/common';
import { EntityEngineModule } from '@packages/entity-engine';
import { RbacIntegrationModule } from '@packages/rbac';
import { ORGANIZATIONS_CONFIG } from './organizations.config';
import { ORGANIZATIONS_PERMISSION_MANIFESTS } from './organizations.permissions';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

@Module({
  imports: [
    EntityEngineModule.forEntity(ORGANIZATIONS_CONFIG),
    RbacIntegrationModule.forFeature({ manifests: ORGANIZATIONS_PERMISSION_MANIFESTS }),
  ],
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
