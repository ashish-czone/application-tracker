import { Injectable } from '@nestjs/common';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import type { BillingClient, BillingClientResolver } from '../types';

const DEFAULT_TYPE = 'default';

@Injectable()
export class BillingClientResolverRegistry {
  private readonly logger: ContextLogger;
  private readonly resolvers = new Map<string, BillingClientResolver>();

  constructor(appLogger: AppLoggerService) {
    this.logger = appLogger.forContext(BillingClientResolverRegistry.name);
  }

  register(resolver: BillingClientResolver, type: string = DEFAULT_TYPE): void {
    this.resolvers.set(type, resolver);
    this.logger.log(`Registered billing client resolver for type: ${type}`);
  }

  async resolve(clientId: string, type?: string): Promise<BillingClient | null> {
    const resolverType = type ?? DEFAULT_TYPE;
    const resolver = this.resolvers.get(resolverType);
    if (!resolver) {
      this.logger.warn(`No billing client resolver registered for type "${resolverType}"`);
      return null;
    }
    return resolver.resolve(clientId);
  }

  has(type?: string): boolean {
    return this.resolvers.has(type ?? DEFAULT_TYPE);
  }
}
