import { Module, type OnModuleInit } from '@nestjs/common';
import {
  LookupResolverService,
  registerEntityLookup,
} from '@packages/entity-engine';
import { RbacIntegrationModule } from '@packages/rbac';
import { createCrudProvider } from '@packages/crud-base';
import { ORGANIZATIONS_PERMISSION_MANIFESTS } from './organizations.permissions';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { ORGANIZATIONS_CRUD_TOKEN } from './organizations.crud-token';
import { organizations } from './organizations.schema';

@Module({
  imports: [
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
export class OrganizationsModule implements OnModuleInit {
  constructor(private readonly lookupResolver: LookupResolverService) {}

  onModuleInit(): void {
    registerEntityLookup(this.lookupResolver, {
      entityType: 'organizations',
      table: organizations,
      labelField: 'name',
      searchFields: ['name'],
    });
  }
}
