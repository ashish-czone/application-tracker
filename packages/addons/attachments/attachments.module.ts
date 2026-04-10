import { Global, Module, type OnModuleInit } from '@nestjs/common';
import { RbacService } from '@packages/rbac';
import { AuditRegistryService } from '@packages/audit';
import { EventRegistryService } from '@packages/events';
import { AttachmentsService } from './services/attachments.service';
import { AttachmentsController } from './controllers/attachments.controller';
import { AttachmentsCleanupListener } from './listeners/attachments-cleanup.listener';
import { ATTACHMENTS_ATTACHMENT_UPLOADED, ATTACHMENTS_ATTACHMENT_DELETED } from './events/types';

@Global()
@Module({
  controllers: [AttachmentsController],
  providers: [AttachmentsService, AttachmentsCleanupListener],
  exports: [AttachmentsService],
})
export class AttachmentsModule implements OnModuleInit {
  constructor(
    private readonly rbacService: RbacService,
    private readonly auditRegistry: AuditRegistryService,
    private readonly eventRegistry: EventRegistryService,
    private readonly attachmentsService: AttachmentsService,
  ) {}

  onModuleInit() {
    // Register RBAC permissions
    this.rbacService.registerPermissions('attachments', [
      { action: 'read', description: 'View attachments' },
      { action: 'create', description: 'Upload attachments' },
      { action: 'delete', description: 'Delete attachments' },
    ]);

    // Register audit events
    this.auditRegistry.register('attachments', {
      events: [ATTACHMENTS_ATTACHMENT_UPLOADED, ATTACHMENTS_ATTACHMENT_DELETED],
    });

    // Register event definitions for discovery
    this.eventRegistry.register({
      eventName: ATTACHMENTS_ATTACHMENT_UPLOADED,
      group: 'attachments',
      description: 'Fired when an attachment is uploaded',
      payloadSchema: {},
    });
    this.eventRegistry.register({
      eventName: ATTACHMENTS_ATTACHMENT_DELETED,
      group: 'attachments',
      description: 'Fired when an attachment is deleted',
      payloadSchema: {},
    });
  }
}
