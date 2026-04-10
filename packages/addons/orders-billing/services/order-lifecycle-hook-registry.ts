import { Injectable } from '@nestjs/common';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import type { OrderLifecycleHooks, CreateOrderInput, OrderRecord } from '../types';

@Injectable()
export class OrderLifecycleHookRegistry {
  private readonly logger: ContextLogger;
  private readonly hooks: OrderLifecycleHooks[] = [];

  constructor(appLogger: AppLoggerService) {
    this.logger = appLogger.forContext(OrderLifecycleHookRegistry.name);
  }

  register(hooks: OrderLifecycleHooks): void {
    this.hooks.push(hooks);
    this.logger.log('Registered order lifecycle hooks');
  }

  async runBeforeCreate(input: CreateOrderInput): Promise<CreateOrderInput> {
    let result = input;
    for (const hook of this.hooks) {
      if (hook.beforeCreate) {
        result = await hook.beforeCreate(result);
      }
    }
    return result;
  }

  async runAfterCreate(order: OrderRecord): Promise<void> {
    for (const hook of this.hooks) {
      if (hook.afterCreate) {
        await hook.afterCreate(order);
      }
    }
  }
}
