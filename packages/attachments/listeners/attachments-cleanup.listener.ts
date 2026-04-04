import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { DomainEvent } from '@packages/events';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { AttachmentsService } from '../services/attachments.service';

@Injectable()
export class AttachmentsCleanupListener {
  private readonly logger: ContextLogger;

  constructor(
    private readonly attachmentsService: AttachmentsService,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(AttachmentsCleanupListener.name);
  }

  @OnEvent('**')
  async handleDomainEvent(event: DomainEvent): Promise<void> {
    if (!event.eventName.endsWith('.Deleted')) return;

    try {
      await this.attachmentsService.softDeleteAllForEntity(event.entityType, event.entityId, event.actorId ?? 'system');
    } catch (error) {
      this.logger.error('Failed to cascade soft-delete attachments', {
        entityType: event.entityType,
        entityId: event.entityId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
