import { Module } from '@nestjs/common';
import { EntityEngineModule } from '@packages/entity-engine';
import { RbacIntegrationModule } from '@packages/rbac';
import { createCrudProvider } from '@packages/crud-base';
import { ComplianceFilingsModule } from '../compliance-filings';
import { ComplianceRulesModule } from '../rules';
import { CLIENT_REGISTRATIONS_CONFIG } from './client-registrations.config';
import { CLIENT_REGISTRATIONS_PERMISSION_MANIFESTS } from './client-registrations.permissions';
import { ClientRegistrationsController } from './client-registrations.controller';
import { ClientRegistrationsService } from './client-registrations.service';
import { CLIENT_REGISTRATIONS_CRUD_TOKEN } from './client-registrations.crud-token';
import { complianceClientRegistrations } from './client-registrations.schema';

@Module({
  imports: [
    EntityEngineModule.forEntity(CLIENT_REGISTRATIONS_CONFIG),
    RbacIntegrationModule.forFeature({ manifests: CLIENT_REGISTRATIONS_PERMISSION_MANIFESTS }),
    ComplianceFilingsModule,
    ComplianceRulesModule,
  ],
  controllers: [ClientRegistrationsController],
  providers: [
    createCrudProvider(CLIENT_REGISTRATIONS_CRUD_TOKEN, complianceClientRegistrations, {
      slug: 'client-registrations',
      events: {
        created: 'client-registrations.Created',
        updated: 'client-registrations.Updated',
        deleted: 'client-registrations.Deleted',
      },
    }),
    ClientRegistrationsService,
  ],
  exports: [ClientRegistrationsService],
})
export class ClientRegistrationsModule {}
