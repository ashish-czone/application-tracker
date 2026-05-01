import { Global, Module, type OnModuleInit } from '@nestjs/common';
import { WORKFLOW_EXTENSION } from '@packages/entity-engine/extensions';
import { FeatureDeriverRegistry } from '@packages/entity-engine';
import { WorkflowsModule } from '@packages/workflows';
import { WorkflowExtensionAdapter } from './workflow-extension.adapter';
import { workflowFeatureDeriver } from './feature';

/**
 * Binds the workflows runtime to entity-engine.
 *
 * Apps that wire entity-engine and want workflow-typed fields to
 * auto-publish their feature bag and route transitions through the
 * workflows engine should import this module. Apps that use
 * `@packages/workflows` standalone (driving transitions via direct
 * service calls) should NOT import this module.
 *
 * @Global() because the per-entity factory in entity-engine resolves
 * `WORKFLOW_EXTENSION` via DI token across module boundaries — same
 * convention as the other entity-engine extensions documented as a
 * known architectural debt in CLAUDE.md.
 */
@Global()
@Module({
  imports: [WorkflowsModule],
  providers: [
    WorkflowExtensionAdapter,
    {
      provide: WORKFLOW_EXTENSION,
      useExisting: WorkflowExtensionAdapter,
    },
  ],
  exports: [WORKFLOW_EXTENSION],
})
export class WorkflowsEntityEngineModule implements OnModuleInit {
  constructor(private readonly featureDerivers: FeatureDeriverRegistry) {}

  onModuleInit() {
    this.featureDerivers.register(workflowFeatureDeriver);
  }
}
