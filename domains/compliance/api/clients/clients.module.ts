import { Module, type OnModuleInit } from '@nestjs/common';
import {
  LookupResolverService,
  registerEntityLookup,
} from '@packages/entity-engine';
import { WorkflowsModule } from '@packages/workflows';
import { RbacIntegrationModule } from '@packages/rbac';
import { createCrudProvider } from '@packages/crud-base';
import { CLIENTS_WORKFLOW } from './clients.workflow';
import { CLIENTS_PERMISSION_MANIFESTS } from './clients.permissions';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { ClientDormancyService } from './clients.dormancy.service';
import { ClientsRollupService } from './clients.rollup.service';
import { ClientContactsModule } from '../client-contacts/client-contacts.module';
import { ClientRegistrationsModule } from '../client-registrations';
import { CLIENTS_CRUD_TOKEN } from './clients.crud-token';
import { clients } from './clients.schema';

/**
 * Clients module — fully de-engined. Workflow orchestration goes through
 * `WorkflowEngineService` directly from `ClientsService.transition`; the
 * dormancy cascade composes inside the same tx as the column update +
 * `recordHistory` write. Lookup registration (so other entities can
 * resolve `clientId` references) is via `registerEntityLookup` in
 * `onModuleInit` — no `defineEntity` config.
 */
@Module({
  imports: [
    WorkflowsModule.forFeature(CLIENTS_WORKFLOW),
    RbacIntegrationModule.forFeature({ manifests: CLIENTS_PERMISSION_MANIFESTS }),
    ClientContactsModule,
    ClientRegistrationsModule,
  ],
  controllers: [ClientsController],
  providers: [
    createCrudProvider(CLIENTS_CRUD_TOKEN, clients, {
      slug: 'clients',
      events: {
        created: 'clients.Created',
        updated: 'clients.Updated',
        deleted: 'clients.Deleted',
      },
    }),
    ClientsService,
    ClientDormancyService,
    ClientsRollupService,
  ],
  exports: [ClientsService, ClientDormancyService],
})
export class ClientsModule implements OnModuleInit {
  constructor(private readonly lookupResolver: LookupResolverService) {}

  onModuleInit(): void {
    registerEntityLookup(this.lookupResolver, {
      entityType: 'clients',
      table: clients,
      labelField: 'name',
      searchFields: ['name', 'legalName'],
    });
  }
}
