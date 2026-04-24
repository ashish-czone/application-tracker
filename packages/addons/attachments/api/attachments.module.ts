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
    this.rbacService.registerManifests([
      { slug: 'attachments.read',   module: 'attachments', action: 'read',   label: 'View attachments',   description: 'View attachments',   supportedScopes: ['any'] },
      { slug: 'attachments.create', module: 'attachments', action: 'create', label: 'Upload attachments', description: 'Upload attachments', supportedScopes: ['any'] },
      { slug: 'attachments.delete', module: 'attachments', action: 'delete', label: 'Delete attachments', description: 'Delete attachments', supportedScopes: ['any'] },
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
