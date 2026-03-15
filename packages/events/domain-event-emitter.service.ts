import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'crypto';

@Injectable()
export class DomainEventEmitter {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  emit(eventName: string, params: {
    entityType: string;
    entityId: string;
    actorId: string | null;
    payload: Record<string, unknown>;
  }) {
    this.eventEmitter.emit(eventName, {
      eventName,
      entityType: params.entityType,
      entityId: params.entityId,
      actorId: params.actorId,
      correlationId: randomUUID(),
      occurredAt: new Date().toISOString(),
      payload: params.payload,
    });
  }
}
