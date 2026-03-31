import { Global, Module, type OnModuleInit } from '@nestjs/common';
import { RbacService } from '@packages/rbac';
import { fieldTypeRegistry } from '@packages/field-types';
import { workflowFieldTypesPlugin } from './field-types';
import { WorkflowGuardRegistry } from './services/workflow-guard-registry.service';
import { WorkflowRegistryService } from './services/workflow-registry.service';
import { WorkflowEngineService } from './services/workflow-engine.service';
import { PipelineResolverService } from './services/pipeline-resolver.service';
import { WorkflowsController } from './controllers/workflows.controller';

@Global()
@Module({
  controllers: [WorkflowsController],
  providers: [
    WorkflowGuardRegistry,
    WorkflowRegistryService,
    WorkflowEngineService,
    PipelineResolverService,
  ],
  exports: [
    WorkflowGuardRegistry,
    WorkflowRegistryService,
    WorkflowEngineService,
    PipelineResolverService,
  ],
})
export class WorkflowsModule implements OnModuleInit {
  constructor(private readonly rbacService: RbacService) {}

  onModuleInit() {
    if (!fieldTypeRegistry.has('workflow')) {
      fieldTypeRegistry.registerPlugin(workflowFieldTypesPlugin);
    }

    this.rbacService.registerPermissions('workflows', [
      { action: 'read', description: 'View workflow definitions' },
      { action: 'manage', description: 'Create, update, and delete workflow definitions, states, and transitions' },
    ]);
  }
}
