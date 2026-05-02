import { Module, type OnModuleInit } from '@nestjs/common';
import {
  LookupResolverService,
  registerEntityLookup,
} from '@packages/entity-engine';
import { RbacIntegrationModule } from '@packages/rbac';
import { createCrudProvider } from '@packages/crud-base';
import { CLIENT_CONTACTS_PERMISSION_MANIFESTS } from './client-contacts.permissions';
import { ClientContactsController } from './client-contacts.controller';
import { ClientContactsService } from './client-contacts.service';
import { CLIENT_CONTACTS_CRUD_TOKEN } from './client-contacts.crud-token';
import { clientContacts } from './client-contacts.schema';

@Module({
  imports: [
    RbacIntegrationModule.forFeature({ manifests: CLIENT_CONTACTS_PERMISSION_MANIFESTS }),
  ],
  controllers: [ClientContactsController],
  providers: [
    createCrudProvider(CLIENT_CONTACTS_CRUD_TOKEN, clientContacts, {
      slug: 'client-contacts',
      events: {
        created: 'client-contacts.Created',
        updated: 'client-contacts.Updated',
        deleted: 'client-contacts.Deleted',
      },
    }),
    ClientContactsService,
  ],
  exports: [ClientContactsService],
})
export class ClientContactsModule implements OnModuleInit {
  constructor(private readonly lookupResolver: LookupResolverService) {}

  onModuleInit(): void {
    registerEntityLookup(this.lookupResolver, {
      entityType: 'client-contacts',
      table: clientContacts,
      labelField: 'fullName',
      searchFields: ['fullName'],
    });
  }
}
