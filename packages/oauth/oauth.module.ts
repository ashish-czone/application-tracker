import { Module, type DynamicModule, type OnModuleInit } from '@nestjs/common';
import { AppLoggerService } from '@packages/logger';
import { AppConfigService } from '@packages/settings';
import { AuthAdapterRegistry, type AuthAdapter, type AuthAdapterResult } from '@packages/auth';
import { OAuthProviderRegistry } from './providers/oauth-provider-registry';
import { OAuthAuthAdapter } from './oauth-auth.adapter';
import { GoogleOAuthProvider } from './providers/google-oauth.provider';
import { OAuthController } from './oauth.controller';
import { SUPPORTED_PROVIDERS } from './types';

@Module({})
export class OAuthModule implements OnModuleInit {
  constructor(
    private readonly oauthProviderRegistry: OAuthProviderRegistry,
    private readonly oauthAuthAdapter: OAuthAuthAdapter,
    private readonly authAdapterRegistry: AuthAdapterRegistry,
    private readonly googleProvider: GoogleOAuthProvider,
    private readonly appConfig: AppConfigService,
    private readonly appLogger: AppLoggerService,
  ) {}

  static register(): DynamicModule {
    return {
      module: OAuthModule,
      controllers: [OAuthController],
      providers: [
        OAuthProviderRegistry,
        OAuthAuthAdapter,
        GoogleOAuthProvider,
      ],
      exports: [OAuthProviderRegistry],
    };
  }

  onModuleInit() {
    const logger = this.appLogger.forContext(OAuthModule.name);

    // Register OAuth settings with AppConfigService for admin UI
    const defaults: Record<string, unknown> = {};
    const metadata: Record<string, { label: string; type: 'string' | 'password'; description: string }> = {};

    for (const provider of SUPPORTED_PROVIDERS) {
      defaults[`${provider}.clientId`] = '';
      defaults[`${provider}.clientSecret`] = '';
      metadata[`${provider}.clientId`] = {
        label: `${provider.charAt(0).toUpperCase() + provider.slice(1)} Client ID`,
        type: 'string',
        description: `OAuth client ID from ${provider.charAt(0).toUpperCase() + provider.slice(1)} developer console`,
      };
      metadata[`${provider}.clientSecret`] = {
        label: `${provider.charAt(0).toUpperCase() + provider.slice(1)} Client Secret`,
        type: 'password',
        description: `OAuth client secret from ${provider.charAt(0).toUpperCase() + provider.slice(1)} developer console`,
      };
    }

    this.appConfig.register('oauth', {
      label: 'OAuth Providers',
      defaults,
      metadata,
    });

    // Register built-in OAuth providers
    const providerMap: Record<string, any> = {
      google: this.googleProvider,
    };

    for (const providerName of SUPPORTED_PROVIDERS) {
      const builtinProvider = providerMap[providerName];
      if (builtinProvider) {
        this.oauthProviderRegistry.register(builtinProvider);
      }
    }

    // Register each provider as an auth adapter
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
