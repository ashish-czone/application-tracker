import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '@packages/auth';
import { AppConfigService } from '@packages/settings';
import { OAuthProviderRegistry } from './providers/oauth-provider-registry';
import { SUPPORTED_PROVIDERS, getOAuthProviderConfig } from './types';

@ApiTags('auth/oauth')
@Controller('auth/oauth')
export class OAuthController {
  constructor(
    private readonly providerRegistry: OAuthProviderRegistry,
    private readonly appConfig: AppConfigService,
  ) {}

  @Public()
  @Get('providers')
  @ApiOperation({ summary: 'List available OAuth providers' })
  getProviders() {
    const result: { provider: string; clientId: string; scopes: string[] }[] = [];

    for (const providerName of SUPPORTED_PROVIDERS) {
      const config = getOAuthProviderConfig(this.appConfig, providerName);
      if (!config) continue; // Not configured — skip

      const provider = this.providerRegistry.get(providerName);
      result.push({
        provider: providerName,
        clientId: config.clientId,
        scopes: provider?.defaultScopes ?? [],
      });
    }

    return result;
  }
}
