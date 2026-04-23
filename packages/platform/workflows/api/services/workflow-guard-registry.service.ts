import { Injectable } from '@nestjs/common';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import type {
  GuardExecutionResult,
  WorkflowGuardFn,
  WorkflowGuardContext,
} from '../types';

@Injectable()
export class WorkflowGuardRegistry {
  private readonly logger: ContextLogger;
  private readonly guards = new Map<string, WorkflowGuardFn>();

  constructor(appLogger: AppLoggerService) {
    this.logger = appLogger.forContext(WorkflowGuardRegistry.name);
  }

  register(name: string, guard: WorkflowGuardFn): void {
    this.guards.set(name, guard);
    this.logger.log(`Registered workflow guard: ${name}`);
  }

  get(name: string): WorkflowGuardFn | undefined {
    return this.guards.get(name);
  }

  has(name: string): boolean {
    return this.guards.has(name);
  }

  /**
   * Run every guard in `names` against the given context. Collects all
   * warnings and blockers rather than short-circuiting — the UI preflight
   * displays all of them together, and the commit-side validator throws
   * using the first blocker's message (see WorkflowEngineService).
   */
  async runGuards(
    names: string[],
    context: WorkflowGuardContext,
  ): Promise<GuardExecutionResult> {
    const warnings: string[] = [];
    const blockers: Array<{ guardName: string; message: string }> = [];

    for (const name of names) {
      const guard = this.guards.get(name);
      if (!guard) {
        throw new Error(`Workflow guard '${name}' is not registered`);
      }

      const result = await guard(context);
      if (result.decision === 'allow') continue;
      if (result.decision === 'allow_with_warning') {
        warnings.push(result.message);
        continue;
      }
      blockers.push({ guardName: name, message: result.message });
    }

    return { warnings, blockers };
  }
}
