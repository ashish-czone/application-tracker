import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AppLoggerService, type ContextLogger, getCorrelationId } from '@packages/logger';
import type { EventPayloadMap } from './types';

@Injectable()
export class DomainEventEmitter {
  private readonly logger: ContextLogger;

  constructor(
    private readonly eventEmitter: EventEmitter2,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(DomainEventEmitter.name);
  }

  /**
   * Emit a dynamically-named event (for entity engine where event names
   * are derived from config at runtime, not compile-time).
   */
  emitDynamic(
    eventName: string,
    params: {
      entityType: string;
      entityId: string;
      actorId: string | null;
      payload: Record<string, unknown>;
    },
  ) {
    return this.emit(eventName as keyof EventPayloadMap, params as any);
  }

  emit<T extends keyof EventPayloadMap>(
    eventName: T,
    params: {
      entityType: string;
      entityId: string;
      actorId: string | null;
      payload: EventPayloadMap[T];
    },
  ) {
    const event = {
      eventName,
      entityType: params.entityType,
      entityId: params.entityId,
      actorId: params.actorId,
      correlationId: getCorrelationId(),
      occurredAt: new Date().toISOString(),
      payload: params.payload,
    };

    // Use emitAsync so async listener errors are caught here instead of
    // becoming unhandled promise rejections. The catch ensures listener
    // failures never propagate back to the emitting service — the domain
    // operation already succeeded.
    this.eventEmitter.emitAsync(eventName as string, event).catch((error) => {
      this.logger.error('Event listener failed', {
        eventName: eventName as string,
        entityType: params.entityType,
        entityId: params.entityId,
        error: error instanceof Error ? error.message : String(error),
      }, error instanceof Error ? error.stack : undefined);
    });
  }
}
