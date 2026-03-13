import { Global, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EventRegistryService } from './event-registry.service';

@Global()
@Module({
  imports: [EventEmitterModule.forRoot({ wildcard: true })],
  providers: [EventRegistryService],
  exports: [EventRegistryService],
})
export class EventsModule {}
