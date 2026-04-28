import { Module } from '@nestjs/common';
import { DirectoryModule } from '@packages/directory';
import { EntityEngineModule } from '@packages/entity-engine';
import { CLIENTS_CONFIG } from './clients.config';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';

@Module({
  imports: [
    EntityEngineModule.forEntity(CLIENTS_CONFIG),
    DirectoryModule,
  ],
  controllers: [ClientsController],
  providers: [ClientsService],
})
export class ClientsModule {}
