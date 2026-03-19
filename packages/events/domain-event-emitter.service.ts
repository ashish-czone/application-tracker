import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getCorrelationId } from '@packages/logger';
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
      correlationId: getCorrelationId(),
      occurredAt: new Date().toISOString(),
      payload: params.payload,
    });
  }
}
