import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@packages/auth-core';
import { AppConfigService } from '@packages/settings';
import { MediaAssetsResolverService } from '@packages/media-library-api';
import { PUBLIC_SITE_KEYS, SITE_DEFAULTS, type SiteSettingKey } from './settings';

export type PublicSiteSettings = {
  [K in (typeof PUBLIC_SITE_KEYS)[number]]: (typeof SITE_DEFAULTS)[K];
};

// Settings whose stored value is a media-asset UUID. The admin edits
// them as references to rows in `media_assets`; the public endpoint
// resolves them to the asset's public URL so the customer portal can
// render them without a second round-trip.
const MEDIA_KEYS = ['companyLogo', 'defaultSeo.ogImage'] as const satisfies ReadonlyArray<
  (typeof PUBLIC_SITE_KEYS)[number]
>;

@ApiTags('site-settings')
@Controller()
export class SiteSettingsController {
  constructor(
    private readonly appConfig: AppConfigService,
    private readonly mediaResolver: MediaAssetsResolverService,
  ) {}

  @Public()
  @Get('public/site-settings')
  @ApiOperation({ summary: 'Public site branding, contact, social, SEO, analytics, and theme' })
  async get(): Promise<PublicSiteSettings> {
    const result = {} as Record<string, unknown>;
    for (const key of PUBLIC_SITE_KEYS) {
      result[key] = this.appConfig.get('site', key satisfies SiteSettingKey);
    }

    const mediaIds = MEDIA_KEYS
      .map((key) => result[key])
      .filter((v): v is string => typeof v === 'string' && v.length > 0);
    const urlsById = await this.mediaResolver.resolveUrls(mediaIds);
    for (const key of MEDIA_KEYS) {
      const value = result[key];
      if (typeof value !== 'string' || value.length === 0) continue;
      result[key] = urlsById.get(value) ?? '';
    }

    return result as PublicSiteSettings;
  }
}
