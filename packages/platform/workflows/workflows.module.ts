import { Global, Module, type OnModuleInit } from '@nestjs/common';
import { RbacService } from '@packages/rbac';
import { ActionRegistry } from '@packages/automations';
import { fieldTypeRegistry } from '@packages/field-types';
import { workflowFieldTypesPlugin } from './field-types';
import { WorkflowGuardRegistry } from './services/workflow-guard-registry.service';
import { WorkflowRegistryService } from './services/workflow-registry.service';
import { WorkflowEngineService } from './services/workflow-engine.service';
import { PipelineResolverService } from './services/pipeline-resolver.service';
import { TransitionWorkflowAction } from './services/transition-workflow.action';
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
  ],
  exports: [
    WorkflowGuardRegistry,
    WorkflowRegistryService,
    WorkflowEngineService,
    PipelineResolverService,
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
