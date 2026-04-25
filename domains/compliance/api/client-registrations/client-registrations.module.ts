import { Module } from '@nestjs/common';
import { EntityEngineModule } from '@packages/entity-engine';
import { ComplianceFilingsModule } from '../compliance-filings/compliance-filings.module';
import { CLIENT_REGISTRATIONS_CONFIG } from './client-registrations.config';
import { ClientRegistrationsController } from './client-registrations.controller';
import { ClientRegistrationsService } from './client-registrations.service';

@Module({
  imports: [
    EntityEngineModule.forEntity(CLIENT_REGISTRATIONS_CONFIG),
    ComplianceFilingsModule,
  ],
  controllers: [ClientRegistrationsController],
  providers: [ClientRegistrationsService],
  exports: [ClientRegistrationsService],
})
export class ClientRegistrationsModule {}
