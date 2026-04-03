import { Inject, Module, type DynamicModule, type OnModuleInit } from '@nestjs/common';
import { AppLoggerService } from '@packages/logger';
import { AuthAdapterRegistry, type AuthAdapter, type AuthAdapterResult } from '@packages/auth';
import { OAuthProviderRegistry } from './providers/oauth-provider-registry';
import { OAuthAuthAdapter } from './oauth-auth.adapter';
import { GoogleOAuthProvider } from './providers/google-oauth.provider';
import { OAuthController } from './oauth.controller';
import { OAUTH_MODULE_CONFIG, type OAuthModuleConfig } from './types';

export interface OAuthModuleAsyncOptions {
  useFactory: (...args: any[]) => OAuthModuleConfig | Promise<OAuthModuleConfig>;
  inject?: any[];
}

@Module({})
export class OAuthModule implements OnModuleInit {
  constructor(
    private readonly oauthProviderRegistry: OAuthProviderRegistry,
    private readonly oauthAuthAdapter: OAuthAuthAdapter,
    private readonly authAdapterRegistry: AuthAdapterRegistry,
    private readonly googleProvider: GoogleOAuthProvider,
    @Inject(OAUTH_MODULE_CONFIG) private readonly config: OAuthModuleConfig,
    private readonly appLogger: AppLoggerService,
  ) {}

  static registerAsync(options: OAuthModuleAsyncOptions): DynamicModule {
    return {
      module: OAuthModule,
      controllers: [OAuthController],
      providers: [
        {
          provide: OAUTH_MODULE_CONFIG,
          useFactory: options.useFactory,
          inject: options.inject ?? [],
        },
        OAuthProviderRegistry,
        OAuthAuthAdapter,
        GoogleOAuthProvider,
      ],
      exports: [OAuthProviderRegistry],
    };
  }

  onModuleInit() {
    const logger = this.appLogger.forContext(OAuthModule.name);

    // Register built-in OAuth providers that are configured
    const providerMap: Record<string, any> = {
      google: this.googleProvider,
    };

    for (const providerConfig of this.config.providers) {
      const builtinProvider = providerMap[providerConfig.provider];
      if (builtinProvider) {
        this.oauthProviderRegistry.register(builtinProvider);
      } else {
        logger.warn(`No built-in OAuth provider for: ${providerConfig.provider}`);
      }
    }

    // Register each configured OAuth provider as an auth adapter
    for (const provider of this.oauthProviderRegistry.getAll()) {
      const adapter: AuthAdapter = {
        provider: provider.provider,
        authenticate: (credentials: Record<string, unknown>): Promise<AuthAdapterResult> => {
          return this.oauthAuthAdapter.authenticateForProvider(provider.provider, credentials);
        },
      };
      this.authAdapterRegistry.register(adapter);
      logger.log(`Registered auth adapter for OAuth provider: ${provider.provider}`);
    }
  }
}
