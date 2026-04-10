import { Injectable } from '@nestjs/common';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import type { OAuthProvider } from './oauth-provider.interface';

@Injectable()
export class OAuthProviderRegistry {
  private readonly providers = new Map<string, OAuthProvider>();
  private readonly logger: ContextLogger;

  constructor(appLogger: AppLoggerService) {
    this.logger = appLogger.forContext(OAuthProviderRegistry.name);
  }

  register(provider: OAuthProvider): void {
    if (this.providers.has(provider.provider)) {
      this.logger.warn(`Overwriting OAuth provider: ${provider.provider}`);
    }
    this.providers.set(provider.provider, provider);
    this.logger.log(`Registered OAuth provider: ${provider.provider}`);
  }

  get(provider: string): OAuthProvider | undefined {
    return this.providers.get(provider);
  }

  has(provider: string): boolean {
    return this.providers.has(provider);
  }

  getAll(): OAuthProvider[] {
    return Array.from(this.providers.values());
  }
}
