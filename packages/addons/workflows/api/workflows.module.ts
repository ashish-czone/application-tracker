import { Global, Module, type OnModuleInit } from '@nestjs/common';
import { RbacIntegrationModule } from '@packages/rbac';
import { ActionRegistry } from '@packages/automation-contracts';
import { WORKFLOW_EXTENSION } from '@packages/entity-engine/extensions';
import { FeatureDeriverRegistry } from '@packages/entity-engine';
import { fieldTypeRegistry } from '@packages/field-types';
import { workflowFieldTypesPlugin } from './field-types';
import { workflowFeatureDeriver } from './feature';
import { WorkflowRegistryService } from './services/workflow-registry.service';
import { WorkflowEngineService } from './services/workflow-engine.service';
import { PipelineResolverService } from './services/pipeline-resolver.service';
import { TransitionWorkflowAction } from './services/transition-workflow.action';
import { WorkflowExtensionAdapter } from './workflow-extension.adapter';
import { WorkflowsController } from './controllers/workflows.controller';

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
    WorkflowExtensionAdapter,
    {
      provide: WORKFLOW_EXTENSION,
      useExisting: WorkflowExtensionAdapter,
    },
  ],
  exports: [
    WorkflowRegistryService,
    WorkflowEngineService,
    PipelineResolverService,
    WORKFLOW_EXTENSION,
  ],
})
export class WorkflowsModule implements OnModuleInit {
  constructor(
    private readonly actionRegistry: ActionRegistry,
    private readonly featureDerivers: FeatureDeriverRegistry,
    private readonly transitionWorkflowAction: TransitionWorkflowAction,
  ) {}

  onModuleInit() {
    if (!fieldTypeRegistry.has('workflow')) {
      fieldTypeRegistry.registerPlugin(workflowFieldTypesPlugin);
    }

    this.actionRegistry.register(this.transitionWorkflowAction);
    this.featureDerivers.register(workflowFeatureDeriver);
  }
}
