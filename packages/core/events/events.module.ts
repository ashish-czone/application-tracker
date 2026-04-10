import { Global, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EventRegistryService } from './event-registry.service';
import { DomainEventEmitter } from './domain-event-emitter.service';

@Global()
@Module({
  imports: [EventEmitterModule.forRoot({ wildcard: true })],
  providers: [EventRegistryService, DomainEventEmitter],
  exports: [EventRegistryService, DomainEventEmitter],
})
export class EventsModule {}
