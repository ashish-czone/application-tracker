import { Module } from '@nestjs/common';
import { EntityEngineModule } from '@packages/entity-engine';
import { CLIENT_CONTACTS_CONFIG } from './client-contacts.config';
import { ClientContactsController } from './client-contacts.controller';
import { ClientContactsService } from './client-contacts.service';

@Module({
  imports: [
    EntityEngineModule.forEntity(CLIENT_CONTACTS_CONFIG),
  ],
  controllers: [ClientContactsController],
  providers: [ClientContactsService],
  exports: [ClientContactsService],
})
export class ClientContactsModule {}
