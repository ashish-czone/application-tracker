import { Module } from '@nestjs/common';
import { EntityEngineModule } from '@packages/entity-engine';
import { RbacIntegrationModule } from '@packages/rbac';
import { ComplianceFilingsModule } from '../compliance-filings';
import { ComplianceRulesModule } from '../rules';
import { CLIENT_REGISTRATIONS_CONFIG } from './client-registrations.config';
import { CLIENT_REGISTRATIONS_PERMISSION_MANIFESTS } from './client-registrations.permissions';
import { ClientRegistrationsController } from './client-registrations.controller';
import { ClientRegistrationsService } from './client-registrations.service';

@Module({
  imports: [
    EntityEngineModule.forEntity(CLIENT_REGISTRATIONS_CONFIG),
    RbacIntegrationModule.forFeature({ manifests: CLIENT_REGISTRATIONS_PERMISSION_MANIFESTS }),
    ComplianceFilingsModule,
    ComplianceRulesModule,
  ],
  controllers: [ClientRegistrationsController],
  providers: [ClientRegistrationsService],
  exports: [ClientRegistrationsService],
})
export class ClientRegistrationsModule {}
