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
 * and ensures each one exists in the workflow registry at module init.
 *
 * Idempotency contract for v1:
 *   - First-time registration creates the definition + states + transitions.
 *   - Subsequent boots find the slug already present and skip re-registration.
 *
 * Updates to an existing workflow's states/transitions via re-running
 * `forFeature` are NOT applied automatically in v1 — admins edit via the
 * workflows UI, or operators apply a manual SQL migration. A future iteration
 * may add a diff-based reconciliation, but it has to interact carefully with
 * any concurrent edits made via the admin UI.
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

  async onModuleInit(): Promise<void> {
    for (const def of this.defs) {
      await this.registerOnce(def);
    }
  }

  private async registerOnce(def: WorkflowDefinition): Promise<void> {
    if (this.registry.getBySlug(def.slug)) {
      // Already in registry — first-boot creation already done. Subsequent
      // boots no-op. See module docstring for the v1 idempotency contract.
      return;
    }

    const definition = await this.registry.createDefinition({
      slug: def.slug,
      name: def.name ?? def.slug,
      entityType: def.entityType,
      fieldName: def.fieldName,
      initialState: def.initialState,
    });

    const stateIdByName = new Map<string, string>();
    for (let i = 0; i < def.states.length; i++) {
      const s = def.states[i];
      const state = await this.registry.createState(definition.id, {
        name: s.name,
        label: s.label,
        color: s.color,
        sortOrder: i,
        isSystem: s.isSystem ?? false,
      });
      stateIdByName.set(s.name, state.id);
    }

    for (const transition of def.transitions) {
      const fromStateId = stateIdByName.get(transition.from);
      if (!fromStateId) {
        this.logger.warn(
          `Skipping transition with unknown from-state '${transition.from}' on workflow '${def.slug}'`,
        );
        continue;
      }

      for (let i = 0; i < transition.to.length; i++) {
        const target = transition.to[i];
        const isString = typeof target === 'string';
        const targetName = isString ? target : target.state;
        const targetDef = isString ? undefined : target;

        const toStateId = stateIdByName.get(targetName);
        if (!toStateId) {
          this.logger.warn(
            `Skipping transition with unknown to-state '${targetName}' on workflow '${def.slug}'`,
          );
          continue;
        }

        const targetState = def.states.find((s) => s.name === targetName);
        const name = targetState?.label ?? targetName;

        await this.registry.createTransition(definition.id, {
          fromStateId,
          toStateId,
          name,
          requiredPermissions: targetDef?.requiredPermissions,
          sortOrder: i,
          reasonRequired: targetDef?.reasonRequired,
          commentRequired: targetDef?.commentRequired,
          reasonOptions: targetDef?.reasonOptions,
        });
      }
    }

    this.logger.log(
      `Registered workflow '${def.slug}' (${def.states.length} states, ${def.transitions.length} from-state groups)`,
    );
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
