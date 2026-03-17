import { Global, Module } from '@nestjs/common';
import { WorkflowGuardRegistry } from './services/workflow-guard-registry.service';
import { WorkflowRegistryService } from './services/workflow-registry.service';
import { WorkflowEngineService } from './services/workflow-engine.service';

@Global()
@Module({
  providers: [
    WorkflowGuardRegistry,
    WorkflowRegistryService,
    WorkflowEngineService,
  ],
  exports: [
    WorkflowGuardRegistry,
    WorkflowRegistryService,
    WorkflowEngineService,
  ],
})
export class WorkflowsModule {}
