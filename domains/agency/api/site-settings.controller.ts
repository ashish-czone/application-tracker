import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@packages/auth-core';
import { AppConfigService } from '@packages/settings';
import { PUBLIC_SITE_KEYS, SITE_DEFAULTS, type SiteSettingKey } from './settings';

export type PublicSiteSettings = {
  [K in (typeof PUBLIC_SITE_KEYS)[number]]: (typeof SITE_DEFAULTS)[K];
};

@ApiTags('site-settings')
@Controller()
export class SiteSettingsController {
  constructor(private readonly appConfig: AppConfigService) {}

  @Public()
  @Get('public/site-settings')
  @ApiOperation({ summary: 'Public site branding, contact, social, SEO, analytics, and theme' })
  get(): PublicSiteSettings {
    const result = {} as Record<string, unknown>;
    for (const key of PUBLIC_SITE_KEYS) {
      result[key] = this.appConfig.get('site', key satisfies SiteSettingKey);
    }
    return result as PublicSiteSettings;
  }
}
