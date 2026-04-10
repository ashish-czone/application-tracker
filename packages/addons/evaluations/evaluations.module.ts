import { Global, Module, type OnModuleInit } from '@nestjs/common';
import { RbacService } from '@packages/rbac';
import { AuditRegistryService } from '@packages/audit';
import { EventRegistryService } from '@packages/events';
import { EvaluationTemplatesService } from './services/evaluation-templates.service';
import { EvaluationsService } from './services/evaluations.service';
import { EvaluationTemplatesController } from './controllers/evaluation-templates.controller';
import { EvaluationsController } from './controllers/evaluations.controller';
import {
  EVALUATIONS_EVALUATION_SUBMITTED,
  EVALUATIONS_EVALUATION_UPDATED,
  EVALUATIONS_EVALUATION_DELETED,
} from './events/types';

@Global()
@Module({
  controllers: [EvaluationTemplatesController, EvaluationsController],
  providers: [EvaluationTemplatesService, EvaluationsService],
  exports: [EvaluationTemplatesService, EvaluationsService],
})
export class EvaluationsModule implements OnModuleInit {
  constructor(
    private readonly rbacService: RbacService,
    private readonly auditRegistry: AuditRegistryService,
    private readonly eventRegistry: EventRegistryService,
  ) {}

  onModuleInit() {
    // Register RBAC permissions
    this.rbacService.registerPermissions('evaluations', [
      { action: 'templates.read', description: 'View evaluation templates' },
      { action: 'templates.manage', description: 'Create, update, and delete evaluation templates' },
      { action: 'read', description: 'View evaluations' },
      { action: 'create', description: 'Create evaluations' },
      { action: 'update', description: 'Update evaluations' },
      { action: 'delete', description: 'Delete evaluations' },
    ]);

    // Register audit events
    this.auditRegistry.register('evaluations', {
      events: [
        EVALUATIONS_EVALUATION_SUBMITTED,
        EVALUATIONS_EVALUATION_UPDATED,
        EVALUATIONS_EVALUATION_DELETED,
      ],
    });

    // Register event definitions for discovery
    this.eventRegistry.register({
      eventName: EVALUATIONS_EVALUATION_SUBMITTED,
      group: 'evaluations',
      description: 'Fired when an evaluation is submitted',
      payloadSchema: {},
    });
    this.eventRegistry.register({
      eventName: EVALUATIONS_EVALUATION_UPDATED,
      group: 'evaluations',
      description: 'Fired when an evaluation is updated',
      payloadSchema: {},
    });
    this.eventRegistry.register({
      eventName: EVALUATIONS_EVALUATION_DELETED,
      group: 'evaluations',
      description: 'Fired when an evaluation is deleted',
      payloadSchema: {},
    });
  }
}
