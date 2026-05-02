import { Module } from '@nestjs/common';
import { RbacIntegrationModule } from '@packages/rbac';
import { createCrudProvider } from '@packages/crud-base';
import { ComplianceFilingsModule } from '../compliance-filings';
import { ComplianceRulesModule } from '../rules';
import { CLIENT_REGISTRATIONS_PERMISSION_MANIFESTS } from './client-registrations.permissions';
import { ClientRegistrationsController } from './client-registrations.controller';
import { ClientRegistrationsService } from './client-registrations.service';
import { CLIENT_REGISTRATIONS_CRUD_TOKEN } from './client-registrations.crud-token';
import { complianceClientRegistrations } from './client-registrations.schema';

/**
 * No `EntityEngineModule.forEntity` and no lookup registration:
 * client-registrations is a join row (clientId × lawId), not a lookup
 * target — referenced by FK from filings and the registrations endpoint
 * itself, never via `?include=…`.
 */
@Module({
  imports: [
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
