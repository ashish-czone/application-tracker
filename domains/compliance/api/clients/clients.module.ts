import { Module } from '@nestjs/common';
import { EntityEngineModule } from '@packages/entity-engine';
import { WorkflowsModule } from '@packages/workflows';
import { RbacIntegrationModule } from '@packages/rbac';
import { CLIENTS_CONFIG } from './clients.config';
import { CLIENTS_WORKFLOW } from './clients.workflow';
import { CLIENTS_PERMISSION_MANIFESTS } from './clients.permissions';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { ClientDormancyService } from './clients.dormancy.service';
import { ClientsRollupService } from './clients.rollup.service';
import { ClientContactsModule } from '../client-contacts/client-contacts.module';
import { ClientRegistrationsModule } from '../client-registrations';

@Module({
  imports: [
    EntityEngineModule.forEntity(CLIENTS_CONFIG),
    WorkflowsModule.forFeature(CLIENTS_WORKFLOW),
    RbacIntegrationModule.forFeature({ manifests: CLIENTS_PERMISSION_MANIFESTS }),
    ClientContactsModule,
    ClientRegistrationsModule,
  ],
  controllers: [ClientsController],
  providers: [ClientsService, ClientDormancyService, ClientsRollupService],
  exports: [ClientsService, ClientDormancyService],
})
export class ClientsModule {}
