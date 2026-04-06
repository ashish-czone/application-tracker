import { Injectable } from '@nestjs/common';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import type { Product, ProductResolver } from '../types';

@Injectable()
export class ProductResolverRegistry {
  private readonly logger: ContextLogger;
  private readonly resolvers = new Map<string, ProductResolver>();

  constructor(appLogger: AppLoggerService) {
    this.logger = appLogger.forContext(ProductResolverRegistry.name);
  }

  register(type: string, resolver: ProductResolver): void {
    this.resolvers.set(type, resolver);
    this.logger.log(`Registered product resolver for type: ${type}`);
  }

  async resolve(productId: string, type: string): Promise<Product | null> {
    const resolver = this.resolvers.get(type);
    if (!resolver) {
      this.logger.warn(`No product resolver registered for type "${type}"`);
      return null;
    }
    return resolver.resolve(productId);
  }

  has(type: string): boolean {
    return this.resolvers.has(type);
  }
}
