import { Injectable } from '@nestjs/common';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import type { WorkflowGuardFn, WorkflowGuardContext } from '../types';

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

  async executeGuards(
    names: string[],
    context: WorkflowGuardContext,
  ): Promise<{ passed: boolean; failedGuard?: string }> {
    for (const name of names) {
      const guard = this.guards.get(name);
      if (!guard) {
        throw new Error(`Workflow guard '${name}' is not registered`);
      }

      const result = await guard(context);
      if (!result) {
        return { passed: false, failedGuard: name };
      }
    }

    return { passed: true };
  }
}
