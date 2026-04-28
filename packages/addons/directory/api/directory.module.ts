import { Module, type OnModuleInit } from '@nestjs/common';
import { RbacService } from '@packages/rbac';
import { AuditRegistryService } from '@packages/audit';
import { EventRegistryService } from '@packages/events';
import {
  DIRECTORY_COMPANY_CREATED,
  DIRECTORY_COMPANY_UPDATED,
  DIRECTORY_COMPANY_MERGED,
  DIRECTORY_PERSON_CREATED,
  DIRECTORY_PERSON_UPDATED,
  DIRECTORY_PERSON_MERGED,
} from './events/types';

@Module({})
export class DirectoryModule implements OnModuleInit {
  constructor(
    private readonly rbac: RbacService,
    private readonly auditRegistry: AuditRegistryService,
    private readonly eventRegistry: EventRegistryService,
  ) {}

  onModuleInit() {
    this.rbac.registerManifests([
      {
        slug: 'directory.merge',
        module: 'directory',
        action: 'merge',
        label: 'Merge directory records',
        description: 'Merge two companies or two people in the identity directory',
        supportedScopes: ['any'],
      },
    ]);

    this.auditRegistry.register('directory', {
      events: [
        DIRECTORY_COMPANY_CREATED,
        DIRECTORY_COMPANY_UPDATED,
        DIRECTORY_COMPANY_MERGED,
        DIRECTORY_PERSON_CREATED,
        DIRECTORY_PERSON_UPDATED,
        DIRECTORY_PERSON_MERGED,
      ],
    });

    for (const eventName of [
      DIRECTORY_COMPANY_CREATED,
      DIRECTORY_COMPANY_UPDATED,
      DIRECTORY_COMPANY_MERGED,
      DIRECTORY_PERSON_CREATED,
      DIRECTORY_PERSON_UPDATED,
      DIRECTORY_PERSON_MERGED,
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
