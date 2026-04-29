import { Module, type OnModuleInit } from '@nestjs/common';
import { RbacIntegrationModule } from '@packages/rbac';
import { AuditRegistryService } from '@packages/audit';
import { EventRegistryService } from '@packages/events';
import { NotesService } from './services/notes.service';
import { NotesController } from './controllers/notes.controller';
import { NotesCleanupListener } from './listeners/notes-cleanup.listener';
import { NOTES_NOTE_CREATED, NOTES_NOTE_UPDATED, NOTES_NOTE_DELETED } from './events/types';

@Module({
  imports: [
    RbacIntegrationModule.forFeature({
      manifests: [
        { slug: 'notes.read',   module: 'notes', action: 'read',   label: 'View notes',   description: 'View notes',   supportedScopes: ['any'] },
        { slug: 'notes.create', module: 'notes', action: 'create', label: 'Create notes', description: 'Create notes', supportedScopes: ['any'] },
        { slug: 'notes.update', module: 'notes', action: 'update', label: 'Update notes', description: 'Update notes', supportedScopes: ['any'] },
        { slug: 'notes.delete', module: 'notes', action: 'delete', label: 'Delete notes', description: 'Delete notes', supportedScopes: ['any'] },
      ],
    }),
  ],
  controllers: [NotesController],
  providers: [NotesService, NotesCleanupListener],
  exports: [NotesService],
})
export class NotesModule implements OnModuleInit {
  constructor(
    private readonly auditRegistry: AuditRegistryService,
    private readonly eventRegistry: EventRegistryService,
    private readonly notesService: NotesService,
  ) {}

  onModuleInit() {
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
