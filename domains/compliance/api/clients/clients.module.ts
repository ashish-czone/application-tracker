import { Module } from '@nestjs/common';
import { EntityEngineModule } from '@packages/entity-engine';
import { CLIENTS_CONFIG } from './clients.config';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { ClientDormancyService } from './client-dormancy.service';
import { ClientContactsModule } from '../client-contacts/client-contacts.module';
import { ClientRegistrationsModule } from '../client-registrations/client-registrations.module';

@Module({
  imports: [
    EntityEngineModule.forEntity(CLIENTS_CONFIG, { controller: 'none' }),
    ClientContactsModule,
    ClientRegistrationsModule,
  ],
  controllers: [ClientsController],
  providers: [ClientsService, ClientDormancyService],
  exports: [ClientsService, ClientDormancyService],
})
export class ClientsModule {}
