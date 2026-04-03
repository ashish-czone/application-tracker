import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '@packages/auth';
import { OAuthProviderRegistry } from './providers/oauth-provider-registry';
import { OAUTH_MODULE_CONFIG, type OAuthModuleConfig } from './types';

@ApiTags('auth/oauth')
@Controller('auth/oauth')
export class OAuthController {
  constructor(
    private readonly providerRegistry: OAuthProviderRegistry,
    @Inject(OAUTH_MODULE_CONFIG) private readonly config: OAuthModuleConfig,
  ) {}

  @Public()
  @Get('providers')
  @ApiOperation({ summary: 'List available OAuth providers' })
  getProviders() {
    return this.config.providers.map((providerConfig) => {
      const provider = this.providerRegistry.get(providerConfig.provider);
      return {
        provider: providerConfig.provider,
        clientId: providerConfig.clientId,
        scopes: providerConfig.scopes ?? provider?.defaultScopes ?? [],
      };
    });
  }
}
