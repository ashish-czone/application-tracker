import {
  type DynamicModule,
  Inject,
  Injectable,
  Module,
  type OnModuleInit,
} from '@nestjs/common';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import type { WorkflowDefinition } from './define-workflow';
import { WorkflowRegistryService } from './services/workflow-registry.service';

const WORKFLOW_FEATURE_DEFS = Symbol('WORKFLOW_FEATURE_DEFS');

/**
 * Per-module workflow registrar. Receives one or more `WorkflowDefinition`s
 * and registers each into the in-memory `WorkflowRegistryService` at module
 * init.
 *
 * Code-defined workflows are NOT persisted to the database — they live only
 * in the registry's in-memory cache for the lifetime of the process. The DB
 * is reserved for admin-created workflows. This is the rule documented in
 * `.claude/rules/init-vs-seed.md`: `onModuleInit` is for in-memory registry
 * registration only; DB writes belong in `cli/seed.ts`.
 *
 * Idempotency: re-calling `forFeature(def)` (e.g. across hot module reloads
 * in dev, or in test setups that recreate the app) replaces the cached entry
 * for that slug. There is no "first-boot vs second-boot" branching because
 * there is no DB state to reconcile.
 */
@Injectable()
class WorkflowFeatureRegistrations implements OnModuleInit {
  private readonly logger: ContextLogger;

  constructor(
    @Inject(WORKFLOW_FEATURE_DEFS) private readonly defs: WorkflowDefinition[],
    private readonly registry: WorkflowRegistryService,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext('WorkflowFeatureRegistrations');
  }

  onModuleInit(): void {
    for (const def of this.defs) {
      this.registry.registerInMemory(def);
      this.logger.log(
        `Registered code-defined workflow '${def.slug}' (${def.states.length} states, ${def.transitions.length} from-state groups)`,
      );
    }
  }
}

/**
 * Empty marker module — `WorkflowsModule.forFeature(...)` returns a
 * `DynamicModule` referencing this class so multiple per-module workflow
 * registrations can co-exist without conflicting with the global
 * `WorkflowsModule`.
 */
@Module({})
export class WorkflowsFeatureScope {}

/**
 * Per-module helper for registering workflow definitions declared via
 * `defineWorkflow()`. Add to a module's `imports`:
 *
 * @example
 *   import { defineWorkflow, WorkflowsModule } from '@packages/workflows';
 *
 *   export const RULES_WORKFLOW = defineWorkflow({ ... });
 *
 *   @Module({
 *     imports: [WorkflowsModule.forFeature(RULES_WORKFLOW)],
 *   })
 *   export class RulesModule {}
 *
 * Multiple workflows can be registered in one call:
 *   WorkflowsModule.forFeature(WORKFLOW_A, WORKFLOW_B)
 */
export function workflowsForFeature(...defs: WorkflowDefinition[]): DynamicModule {
  return {
    module: WorkflowsFeatureScope,
    providers: [
      { provide: WORKFLOW_FEATURE_DEFS, useValue: defs },
      WorkflowFeatureRegistrations,
    ],
  };
}
