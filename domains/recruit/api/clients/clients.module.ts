import { Module } from '@nestjs/common';
import { EntityEngineModule } from '@packages/entity-engine';
import { CLIENTS_CONFIG } from './clients.config';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';

@Module({
  imports: [
    EntityEngineModule.forEntity(CLIENTS_CONFIG, { controller: 'none' }),
  ],
  controllers: [ClientsController],
  providers: [ClientsService],
})
export class ClientsModule {}
