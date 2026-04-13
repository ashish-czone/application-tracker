import { Injectable } from '@nestjs/common';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import type { AuthAdapter } from './auth-adapter.interface';

@Injectable()
export class AuthAdapterRegistry {
  private readonly adapters = new Map<string, AuthAdapter>();
  private readonly logger: ContextLogger;

  constructor(appLogger: AppLoggerService) {
    this.logger = appLogger.forContext(AuthAdapterRegistry.name);
  }

  register(adapter: AuthAdapter): void {
    if (this.adapters.has(adapter.provider)) {
      this.logger.warn(`Overwriting auth adapter for provider: ${adapter.provider}`);
    }
    this.adapters.set(adapter.provider, adapter);
    this.logger.log(`Registered auth adapter: ${adapter.provider}`);
  }

  get(provider: string): AuthAdapter | undefined {
    return this.adapters.get(provider);
  }

  has(provider: string): boolean {
    return this.adapters.has(provider);
  }

  getAll(): AuthAdapter[] {
    return Array.from(this.adapters.values());
  }
}
