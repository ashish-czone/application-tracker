import { Module } from '@nestjs/common';
import { DirectoryModule } from '@packages/directory';
import { EntityEngineModule } from '@packages/entity-engine';
import { CONTACTS_CONFIG } from './contacts.config';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';

@Module({
  imports: [
    EntityEngineModule.forEntity(CONTACTS_CONFIG),
    DirectoryModule,
  ],
  controllers: [ContactsController],
  providers: [ContactsService],
})
export class ContactsModule {}
