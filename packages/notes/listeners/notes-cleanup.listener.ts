import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { DomainEvent } from '@packages/events';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { NotesService } from '../services/notes.service';

@Injectable()
export class NotesCleanupListener {
  private readonly logger: ContextLogger;

  constructor(
    private readonly notesService: NotesService,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(NotesCleanupListener.name);
  }

  @OnEvent('**')
  async handleDomainEvent(event: DomainEvent): Promise<void> {
    if (!event.eventName.endsWith('.Deleted')) return;

    try {
      await this.notesService.softDeleteAllForEntity(event.entityType, event.entityId, event.actorId ?? 'system');
    } catch (error) {
      this.logger.error('Failed to cascade soft-delete notes', {
        entityType: event.entityType,
        entityId: event.entityId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
