import { Module, type OnModuleInit } from '@nestjs/common';
import { RbacIntegrationModule } from '@packages/rbac';
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

@Module({
  imports: [
    RbacIntegrationModule.forFeature({
      manifests: [
        { slug: 'evaluations.templates.read',   module: 'evaluations', action: 'templates.read',   label: 'View evaluation templates',   description: 'View evaluation templates',                        supportedScopes: ['any'] },
        { slug: 'evaluations.templates.manage', module: 'evaluations', action: 'templates.manage', label: 'Manage evaluation templates', description: 'Create, update, and delete evaluation templates',  supportedScopes: ['any'] },
        { slug: 'evaluations.read',             module: 'evaluations', action: 'read',             label: 'View evaluations',            description: 'View evaluations',                                 supportedScopes: ['any'] },
        { slug: 'evaluations.create',           module: 'evaluations', action: 'create',           label: 'Create evaluations',          description: 'Create evaluations',                               supportedScopes: ['any'] },
        { slug: 'evaluations.update',           module: 'evaluations', action: 'update',           label: 'Update evaluations',          description: 'Update evaluations',                               supportedScopes: ['any'] },
        { slug: 'evaluations.delete',           module: 'evaluations', action: 'delete',           label: 'Delete evaluations',          description: 'Delete evaluations',                               supportedScopes: ['any'] },
      ],
    }),
  ],
  controllers: [EvaluationTemplatesController, EvaluationsController],
  providers: [EvaluationTemplatesService, EvaluationsService],
  exports: [EvaluationTemplatesService, EvaluationsService],
})
export class EvaluationsModule implements OnModuleInit {
  constructor(
    private readonly auditRegistry: AuditRegistryService,
    private readonly eventRegistry: EventRegistryService,
  ) {}

  onModuleInit() {
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
