import { Module } from '@nestjs/common';
import { EntityEngineModule } from '@packages/entity-engine';
import { RbacIntegrationModule } from '@packages/rbac';
import { createCrudProvider } from '@packages/crud-base';
import { ORGANIZATIONS_CONFIG } from './organizations.config';
import { ORGANIZATIONS_PERMISSION_MANIFESTS } from './organizations.permissions';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { ORGANIZATIONS_CRUD_TOKEN } from './organizations.crud-token';
import { organizations } from './organizations.schema';

@Module({
  imports: [
    EntityEngineModule.forEntity(ORGANIZATIONS_CONFIG),
    RbacIntegrationModule.forFeature({ manifests: ORGANIZATIONS_PERMISSION_MANIFESTS }),
  ],
  controllers: [OrganizationsController],
  providers: [
    createCrudProvider(ORGANIZATIONS_CRUD_TOKEN, organizations, {
      slug: 'organizations',
      events: {
        created: 'organizations.Created',
        updated: 'organizations.Updated',
        deleted: 'organizations.Deleted',
      },
    }),
    OrganizationsService,
  ],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
