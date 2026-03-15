import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'crypto';
import type { EventPayloadMap } from './types';

@Injectable()
export class DomainEventEmitter {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  emit<T extends keyof EventPayloadMap>(
    eventName: T,
    params: {
      entityType: string;
      entityId: string;
      actorId: string | null;
      payload: EventPayloadMap[T];
    },
  ) {
    this.eventEmitter.emit(eventName as string, {
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
