import { Module, type OnModuleInit } from '@nestjs/common';
import { RbacIntegrationModule } from '@packages/rbac';
import { AuditRegistryService } from '@packages/audit';
import { EventRegistryService } from '@packages/events';
import { CompaniesService } from './services/companies.service';
import { PeopleService } from './services/people.service';
import { CompaniesController } from './controllers/companies.controller';
import { PeopleController } from './controllers/people.controller';
import {
  DIRECTORY_COMPANY_CREATED,
  DIRECTORY_COMPANY_UPDATED,
  DIRECTORY_COMPANY_MERGED,
  DIRECTORY_PERSON_CREATED,
  DIRECTORY_PERSON_UPDATED,
  DIRECTORY_PERSON_MERGED,
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
          description: 'Search and read companies / people in the identity directory (picker autocomplete)',
          supportedScopes: ['any'],
        },
        {
          slug: 'directory.merge',
          module: 'directory',
          action: 'merge',
          label: 'Merge directory records',
          description: 'Merge two companies or two people in the identity directory',
          supportedScopes: ['any'],
        },
      ],
    }),
  ],
  controllers: [CompaniesController, PeopleController],
  providers: [CompaniesService, PeopleService],
  exports: [CompaniesService, PeopleService],
})
export class DirectoryModule implements OnModuleInit {
  constructor(
    private readonly auditRegistry: AuditRegistryService,
    private readonly eventRegistry: EventRegistryService,
  ) {}

  onModuleInit() {
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
