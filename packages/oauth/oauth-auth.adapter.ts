import { Inject, Injectable } from '@nestjs/common';
import { AuthService, type AuthAdapterResult } from '@packages/auth';
import { OAuthProviderRegistry } from './providers/oauth-provider-registry';
import { OAUTH_MODULE_CONFIG, type OAuthModuleConfig } from './types';

@Injectable()
export class OAuthAuthAdapter {
  constructor(
    private readonly providerRegistry: OAuthProviderRegistry,
    private readonly authService: AuthService,
    @Inject(OAUTH_MODULE_CONFIG) private readonly config: OAuthModuleConfig,
  ) {}

  async authenticateForProvider(providerName: string, credentials: Record<string, unknown>): Promise<AuthAdapterResult> {
    const { code, redirectUri } = credentials as { code: string; redirectUri: string };
    const oauthProvider = this.providerRegistry.get(providerName);
    if (!oauthProvider) {
      throw new Error(`OAuth provider not registered: ${providerName}`);
    }

    const providerConfig = this.config.providers.find((p) => p.provider === providerName);
    if (!providerConfig) {
      throw new Error(`OAuth provider not configured: ${providerName}`);
    }

    // 1. Exchange code for access token
    const { accessToken } = await oauthProvider.exchangeCode(
      code,
      redirectUri,
      providerConfig.clientId,
      providerConfig.clientSecret,
    );

    // 2. Get user profile from provider
    const profile = await oauthProvider.getUserProfile(accessToken);

    // 3. Look up existing credential
    const credential = await this.authService.findCredential(providerName, profile.providerUserId);
    if (credential) {
      return {
        userId: credential.userId,
        email: profile.email,
        provider: providerName,
        providerIdentifier: profile.providerUserId,
        isNewUser: false,
        isNewCredential: false,
      };
    }

    // 4. Account linking — look up user by email
    const existingUser = await this.authService.findUserByEmail(profile.email);
    if (existingUser) {
      return {
        userId: existingUser.id,
        email: profile.email,
        provider: providerName,
        providerIdentifier: profile.providerUserId,
        isNewUser: false,
        isNewCredential: true,
      };
    }

    // 5. Brand new user
    return {
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      provider: providerName,
      providerIdentifier: profile.providerUserId,
      isNewUser: true,
      isNewCredential: true,
    };
  }
}
