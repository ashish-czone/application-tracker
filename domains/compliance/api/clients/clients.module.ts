import { Module } from '@nestjs/common';
import { EntityEngineModule } from '@packages/entity-engine';
import { CLIENTS_CONFIG } from './clients.config';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { ClientDormancyService } from './clients.dormancy.service';
import { ClientsRollupService } from './clients.rollup.service';
import { ClientContactsModule } from '../client-contacts/client-contacts.module';
import { ClientRegistrationsModule } from '../client-registrations';

@Module({
  imports: [
    EntityEngineModule.forEntity(CLIENTS_CONFIG),
    ClientContactsModule,
    ClientRegistrationsModule,
  ],
  controllers: [ClientsController],
  providers: [ClientsService, ClientDormancyService, ClientsRollupService],
  exports: [ClientsService, ClientDormancyService],
})
export class ClientsModule {}
