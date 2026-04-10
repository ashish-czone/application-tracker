import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { DomainEvent } from '@packages/events';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { ScheduleScanner } from '../services/schedule-scanner';

@Injectable()
export class AutomationsCleanupListener {
  private readonly logger: ContextLogger;

  constructor(
    private readonly scheduleScanner: ScheduleScanner,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(AutomationsCleanupListener.name);
  }

  @OnEvent('**')
  async handleDomainEvent(event: DomainEvent): Promise<void> {
    if (!event.eventName.endsWith('.Deleted')) return;

    try {
      await this.scheduleScanner.deletePendingForEntity(event.entityType, event.entityId);
    } catch (error) {
      this.logger.error('Failed to cancel pending automations', {
        entityType: event.entityType,
        entityId: event.entityId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
