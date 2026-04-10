import { Global, Module, type OnModuleInit } from '@nestjs/common';
import { RbacService } from '@packages/rbac';
import { AuditRegistryService } from '@packages/audit';
import { EventRegistryService } from '@packages/events';
import { NotesService } from './services/notes.service';
import { NotesController } from './controllers/notes.controller';
import { NotesCleanupListener } from './listeners/notes-cleanup.listener';
import { NOTES_NOTE_CREATED, NOTES_NOTE_UPDATED, NOTES_NOTE_DELETED } from './events/types';

@Global()
@Module({
  controllers: [NotesController],
  providers: [NotesService, NotesCleanupListener],
  exports: [NotesService],
})
export class NotesModule implements OnModuleInit {
  constructor(
    private readonly rbacService: RbacService,
    private readonly auditRegistry: AuditRegistryService,
    private readonly eventRegistry: EventRegistryService,
    private readonly notesService: NotesService,
  ) {}

  onModuleInit() {
    // Register RBAC permissions
    this.rbacService.registerPermissions('notes', [
      { action: 'read', description: 'View notes' },
      { action: 'create', description: 'Create notes' },
      { action: 'update', description: 'Update notes' },
      { action: 'delete', description: 'Delete notes' },
    ]);

    // Register audit events
    this.auditRegistry.register('notes', {
      events: [NOTES_NOTE_CREATED, NOTES_NOTE_UPDATED, NOTES_NOTE_DELETED],
    });

    // Register event definitions for discovery
    this.eventRegistry.register({
      eventName: NOTES_NOTE_CREATED,
      group: 'notes',
      description: 'Fired when a note is created',
      payloadSchema: {},
    });
    this.eventRegistry.register({
      eventName: NOTES_NOTE_UPDATED,
      group: 'notes',
      description: 'Fired when a note is updated',
      payloadSchema: {},
    });
    this.eventRegistry.register({
      eventName: NOTES_NOTE_DELETED,
      group: 'notes',
      description: 'Fired when a note is deleted',
      payloadSchema: {},
    });
  }
}
