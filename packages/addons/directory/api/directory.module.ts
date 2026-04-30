import { Module, type OnModuleInit } from '@nestjs/common';
import { RbacIntegrationModule } from '@packages/rbac';
import { AuditRegistryService } from '@packages/audit';
import { EventRegistryService } from '@packages/events';
import { ClientsService } from './services/clients.service';
import { ClientContactsService } from './services/client-contacts.service';
import { ClientsController } from './controllers/clients.controller';
import { ClientContactsController } from './controllers/client-contacts.controller';
import {
  DIRECTORY_CLIENT_CREATED,
  DIRECTORY_CLIENT_UPDATED,
  DIRECTORY_CLIENT_MERGED,
  DIRECTORY_CLIENT_CONTACT_CREATED,
  DIRECTORY_CLIENT_CONTACT_UPDATED,
  DIRECTORY_CLIENT_CONTACT_MERGED,
} from './events/types';

@Module({
  imports: [
    RbacIntegrationModule.forFeature({
      manifests: [
        {
          slug: 'directory.read',
          module: 'directory',
          action: 'read',
          label: 'Read directory records',
          description: 'Search and read clients / client_contacts in the identity directory (picker autocomplete)',
          supportedScopes: ['any'],
        },
        {
          slug: 'directory.merge',
          module: 'directory',
          action: 'merge',
          label: 'Merge directory records',
          description: 'Merge two clients or two client_contacts in the identity directory',
          supportedScopes: ['any'],
        },
      ],
    }),
  ],
  controllers: [ClientsController, ClientContactsController],
  providers: [ClientsService, ClientContactsService],
  exports: [ClientsService, ClientContactsService],
})
export class DirectoryModule implements OnModuleInit {
  constructor(
    private readonly auditRegistry: AuditRegistryService,
    private readonly eventRegistry: EventRegistryService,
  ) {}

  onModuleInit() {
    this.auditRegistry.register('directory', {
      events: [
        DIRECTORY_CLIENT_CREATED,
        DIRECTORY_CLIENT_UPDATED,
        DIRECTORY_CLIENT_MERGED,
        DIRECTORY_CLIENT_CONTACT_CREATED,
        DIRECTORY_CLIENT_CONTACT_UPDATED,
        DIRECTORY_CLIENT_CONTACT_MERGED,
      ],
    });

    for (const eventName of [
      DIRECTORY_CLIENT_CREATED,
      DIRECTORY_CLIENT_UPDATED,
      DIRECTORY_CLIENT_MERGED,
      DIRECTORY_CLIENT_CONTACT_CREATED,
      DIRECTORY_CLIENT_CONTACT_UPDATED,
      DIRECTORY_CLIENT_CONTACT_MERGED,
    ] as const) {
      this.eventRegistry.register({
        eventName,
        group: 'directory',
        description: `Directory: ${eventName}`,
        payloadSchema: {},
      });
    }
  }
}
