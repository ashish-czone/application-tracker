import { Global, Module, type OnModuleInit } from '@nestjs/common';
import { RbacService } from '@packages/rbac';
import { ActionRegistry } from '@packages/automation-contracts';
import { WORKFLOW_EXTENSION } from '@packages/entity-engine/extensions';
import { fieldTypeRegistry } from '@packages/field-types';
import { workflowFieldTypesPlugin } from './field-types';
import { WorkflowGuardRegistry } from './services/workflow-guard-registry.service';
import { WorkflowRegistryService } from './services/workflow-registry.service';
import { WorkflowEngineService } from './services/workflow-engine.service';
import { PipelineResolverService } from './services/pipeline-resolver.service';
import { TransitionWorkflowAction } from './services/transition-workflow.action';
import { WorkflowExtensionAdapter } from './workflow-extension.adapter';
import { WorkflowsController } from './controllers/workflows.controller';

@Global()
@Module({
  controllers: [WorkflowsController],
  providers: [
    WorkflowGuardRegistry,
    WorkflowRegistryService,
    WorkflowEngineService,
    PipelineResolverService,
    TransitionWorkflowAction,
    WorkflowExtensionAdapter,
    {
      provide: WORKFLOW_EXTENSION,
      useExisting: WorkflowExtensionAdapter,
    },
  ],
  exports: [
    WorkflowGuardRegistry,
    WorkflowRegistryService,
    WorkflowEngineService,
    PipelineResolverService,
    WORKFLOW_EXTENSION,
  ],
})
export class WorkflowsModule implements OnModuleInit {
  constructor(
    private readonly rbacService: RbacService,
    private readonly actionRegistry: ActionRegistry,
    private readonly transitionWorkflowAction: TransitionWorkflowAction,
  ) {}

  onModuleInit() {
    if (!fieldTypeRegistry.has('workflow')) {
      fieldTypeRegistry.registerPlugin(workflowFieldTypesPlugin);
    }

    this.rbacService.registerPermissions('workflows', [
      { action: 'read', description: 'View workflow definitions' },
      { action: 'manage', description: 'Create, update, and delete workflow definitions, states, and transitions' },
    ]);

    this.actionRegistry.register(this.transitionWorkflowAction);
  }
}
