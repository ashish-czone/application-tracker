import { Global, Module, type OnModuleInit } from '@nestjs/common';
import { RbacIntegrationModule } from '@packages/rbac';
import { ActionRegistry } from '@packages/automation-contracts';
import { fieldTypeRegistry } from '@packages/field-types';
import { workflowFieldTypesPlugin } from './field-types';
import { WorkflowRegistryService } from './services/workflow-registry.service';
import { WorkflowEngineService } from './services/workflow-engine.service';
import { PipelineResolverService } from './services/pipeline-resolver.service';
import { TransitionWorkflowAction } from './services/transition-workflow.action';
import { WorkflowsController } from './controllers/workflows.controller';

/**
 * Workflows runtime: registry + engine + pipeline resolver + REST surface.
 *
 * This module is entity-engine-free. To bind workflows to entity-engine
 * (auto-publish workflow feature bags, route per-entity-factory transitions
 * through the engine), import `@packages/workflows-entity-engine`'s
 * `WorkflowsEntityEngineModule` alongside this one.
 *
 * Standalone consumers (e.g., domains driving transitions via direct
 * `WorkflowEngineService` calls) need only this module.
 */
@Global()
@Module({
  imports: [
    RbacIntegrationModule.forFeature({
      manifests: [
        { slug: 'workflows.read',   module: 'workflows', action: 'read',   label: 'View workflows',   description: 'View workflow definitions', supportedScopes: ['any'] },
        { slug: 'workflows.manage', module: 'workflows', action: 'manage', label: 'Manage workflows', description: 'Create, update, and delete workflow definitions, states, and transitions', supportedScopes: ['any'] },
      ],
    }),
  ],
  controllers: [WorkflowsController],
  providers: [
    WorkflowRegistryService,
    WorkflowEngineService,
    PipelineResolverService,
    TransitionWorkflowAction,
  ],
  exports: [
    WorkflowRegistryService,
    WorkflowEngineService,
    PipelineResolverService,
  ],
})
export class WorkflowsModule implements OnModuleInit {
  constructor(
    private readonly actionRegistry: ActionRegistry,
    private readonly transitionWorkflowAction: TransitionWorkflowAction,
  ) {}

  onModuleInit() {
    if (!fieldTypeRegistry.has('workflow')) {
      fieldTypeRegistry.registerPlugin(workflowFieldTypesPlugin);
    }

    this.actionRegistry.register(this.transitionWorkflowAction);
  }
}
